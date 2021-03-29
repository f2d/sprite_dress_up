﻿
'use strict';

//* TODO ---------------------- UI, menu: -------------------------------------
//* TODO: consistent UI colors (what blue, yellow, white, etc. means across the whole page).
//* TODO: checkbox/selectbox to sync clicked/all option/export actions in selected project onto all opened projects, where possible.
//* TODO: find zoom/scale of the screen/page before regenerating thumbnails.
//* TODO: options menu: add/remove/copy/edit colors and outlines, or all list(s), maybe in textarea.
//* TODO: options menu: buttons to show all or only relevant select boxes, global and per type header (parts, colors, etc).
//* TODO: options menu: switches for selected keys/values in saved PNG filenames.
//* TODO: <select multiple> <optgroup> <option>?</option> </optgroup> </select>.
//* TODO: batch: store (in)validated combination in a Map by filename as key, and combinations to render (each wrapped in object as pointer to Map element and the filename) in a Set. Or make the checking algorithm faster somehow, without bruteforcing cross-product of all combos.
//* TODO: batch: remember already calculated batch counts and valid lists per project; dict key = joined list of all options and checkboxes.
//* TODO: export: configurable order of options (autosorted by default) and option groups (kept as found in project file) in filename.

//* TODO ---------------------- params: ---------------------------------------
//* TODO: keep all layer-name parameters single-word if possible.
//* TODO: zoom format in filenames: [x1, x1.00, x100%].
//* TODO: outline: more methods.
//* TODO: wireframe rendering.
//* TODO: multiselect?
//* TODO: colors: fix empty folders like "listname [colors batch]" and "listname [colors] / name".
//* TODO: colors: add "name1,2,3,etc[gradient-map=N/N%=rgb-N-N-N/N%=next+rgb-N-N-N/avg|max|min|rgb]" to interpolate between selected given color values in given name order using given source RGB (or avg/max/min of them). If too many gradient points (number of names > 2 + number points), ignore leftover points. If too many names, distribute undefined points evenly in the last (top?) stretch of gradient. Autosort points by %value. Color value after percent may be used to insert given color value or calculate value dependent on next/previous point (cycle in passes until all are defined). 0/100% may be used for defining colors; use names for omitted. If no usable color names, do nothing.

//* TODO ---------------------- rendering: ------------------------------------
//* TODO: collage: fix stuck rendering of oversized collage.
//* TODO: collage: arrange joined images without using DOM, to avoid currently visible images moving to hidden container when saving collage.
//* TODO: clipping: fix hiding of clipping group with skipped/invisible/empty base layer.
//* TODO: copypaste: properly check visibility of (possibly nested) pasted layer; keep track of its current root while rendering; push/pop in pasted layer's prop[]?
//* TODO: blending: arithmetic emulation of all operations, not native to JS.
//* TODO: blending: arithmetic emulation of all operations in 16/32-bit (float?) until final result; optional with checkbox/selectbox.
//* TODO: blending: keep layer images as PNGs, create arrays for high-precision blending on demand, discard arrays when HQ mode is disabled.
//* TODO: encode: set RGB of zero-alpha pixels to average of all non-zero-alpha neighbour RGB values ignoring alpha.
//* TODO: compose: for files without merged image data - render ignoring options, but respecting layer visibility properties. Or buttons to show embedded and/or rendered image regardless of options. Or add this as top-most option for any project, with or without options.
//* TODO: revoke collage blob urls when cleaning view container?
//* TODO: revoke any image blob urls right after image element's loading, without ever tracking/listing them?

//* TODO ---------------------- export: ---------------------------------------
//* TODO: save opened project as restructured ORA/PSD. Try https://github.com/Agamnentzar/ag-psd
//* TODO: save rendered image as WebP. https://bugs.chromium.org/p/chromium/issues/detail?id=170565#c77 - toDataURL/toBlob quality 1.0 = lossless.
//* TODO: make exported project files identically reproducible?

//* TODO ---------------------- other: ----------------------------------------
//* TODO: global job list for WIP cancelling instead of spaghetti-coded flag checks.
//* TODO: split JS files in a way that lets older browsers to use parts they can parse and execute (only show menu, or only load ORA, etc.).
//* TODO: split JS functionality into modules to reuse with drawpad, etc.
//* TODO: whole config in JSON-format?

//* ---------------------------------------------------------------------------
//* Config: defaults, do not change here, redefine in external config file *---

var	exampleRootDir = ''
,	exampleProjectFiles = []

,	DEFAULT_ALPHA_MASK_PADDING = 1
,	DEFAULT_ALPHA_MASK_THRESHOLD = 16
,	DEFAULT_AUTOCROP = 'top-left/transparent'
,	DEFAULT_COLLAGE_ALIGN = 'top-left'
,	DEFAULT_COLLAGE_COLORS = [
		'Transparent'
	,	'White'
	,	'Gray'
	,	'Black'
	,	'MidnightBlue'
	,	'Teal'
	,	'SteelBlue'
	,	'LightSlateGray'
	,	'DeepSkyBlue'
	,	'LightBlue'
	,	'LightGreen'
	,	'LightYellow'
	,	'Magenta'
	]
,	DEFAULT_COLLAGE_PADDING = 0		//* <- add variant to both inside and outside
,	DEFAULT_COLLAGE_PADDING_INSIDE = 2
,	DEFAULT_COLLAGE_PADDING_OUTSIDE = 1

,	PAUSE_WORK_DURATION = 20
,	PAUSE_WORK_INTERVAL = 200

,	ORA_EXPORT_THUMBNAIL_SIZE = 256
,	PREVIEW_SIZE = 80
,	THUMBNAIL_SIZE = 20
,	ZOOM_STEP_MAX_FACTOR = 2

//* If set to 0, use common setting from above:

,	TAB_PREVIEW_SIZE = 0
,	TAB_THUMBNAIL_SIZE = 0
,	TAB_ZOOM_STEP_MAX_FACTOR = 0	//* <- scaling in one step is blocky, stepping by factor of 2 is blurry, 4 may be okay for 20px and less.

,	ADD_BATCH_COUNT_ON_BUTTON	= false	//* <- if not, add separate text element.
,	ADD_BATCH_COUNT_ON_NEW_LINE	= false
,	ADD_PAUSE_AT_INTERVALS		= true	//* <- let UI update when loading files, rendering images, counting batch combinations, etc.
,	ADD_PAUSE_BEFORE_EACH_FOLDER	= false	//* <- can take ~1-5x longer than pause at intervals, but UI response is not very good.
,	ADD_PAUSE_BEFORE_EACH_LAYER	= false	//* <- can take ~1.5-2x longer than pause at folders, but UI response does not improve much.
,	ADD_WIP_TEXT_ROLL		= false	//* <- rotating stick symbol, does not look good in tabs
,	ASK_BEFORE_EXIT_IF_OPENED_FILES	= true	//* <- this is annoying and would not be needed if big files could load fast.
,	CACHE_UNALTERABLE_FOLDERS_MERGED	= true	//* <- not much opportunity if almost everything is recolored or passthrough.
,	CACHE_UNALTERABLE_IMAGES_TRIMMED	= false	//* <- images are compressed faster by canvas API, when stored as PNG.
,	DOWNSCALE_BY_MAX_FACTOR_FIRST	= true	//* <- other way (starting with partial factor) is not better, probably worse.
,	EXAMPLE_NOTICE			= false	//* <- show the warning near the list of files.
,	FILE_NAME_ADD_PARAM_KEY		= true
,	FILE_NAME_OMIT_SINGLE_OPTIONS	= true
,	GET_LAYER_IMAGE_FROM_BITMAP	= true
,	LOCALIZED_CASE_BY_CROSS_COUNT	= false	//* <- determine word case by product of all numbers in args; if not, then by the last number.
,	PRELOAD_ALL_LAYER_IMAGES	= false
,	PRELOAD_USED_LAYER_IMAGES	= false
,	READ_FILE_CONTENT_TO_GET_TYPE	= false	//* <- this relies on the browser or the OS to magically determine file type.
,	REQUIRE_NON_EMPTY_SELECTION	= false	//* <- buggy
,	SAVE_COLOR_AS_ONE_PIXEL_IMAGE	= false	//* <- may be stretched back by layers attributes, but not yet standard.
,	SORT_OPTION_LIST_NAMES		= false
,	START_WITH_BIG_TEXT		= false
,	START_WITH_FIXED_TAB_WIDTH	= true
,	START_WITH_OPEN_FIRST_MENU_TAB	= true
,	TAB_STATUS_TEXT			= true
,	TAB_THUMBNAIL_PRELOAD		= true	//* <- get merged prerendered image from the file before looking at layer tree.
,	TAB_THUMBNAIL_TRIMMED		= false	//* <- more content may become visible, but will take more time and shift image alignment.
,	TAB_THUMBNAIL_ZOOM		= true
,	TAB_THUMBNAIL_ZOOM_TRIMMED	= false
,	TAB_WIDTH_ONLY_GROW		= true	//* <- prevent tabs from shrinking and jumping between rows.
,	TESTING				= false	//* <- dump more info into the console; several levels are possible.
,	TESTING_PNG			= false	//* <- dump a PNG onto the page after converting from pixel data.
,	TESTING_RENDER			= false	//* <- dump a PNG onto the page after each rendering operation.
,	USE_CONSOLE_LOG_GROUPING	= false	//* <- becomes a mess with concurrent operations.
,	USE_MINIFIED_JS			= true	//* <- currently only pako.
,	USE_ONE_FILE_ZIP_WORKER		= false	//* <- concatenated bundle, which is not included in distribution by default.
,	USE_UPNG			= true
,	USE_UZIP			= false
,	USE_WORKERS			= true
,	USE_ZLIB_ASM			= false
,	USE_ZLIB_CODECS			= true	//* <- asm or pako instead of zip.js own.
,	VERIFY_PARAM_COLOR_VS_LAYER_CONTENT	= false
,	ZERO_PERCENT_EQUALS_EMPTY		= false
,	ZIP_SKIP_DUPLICATE_FILENAMES		= true
	;

//* ---------------------------------------------------------------------------
//* Create type-checking functions, e.g. "isString()" or "isImageElement()":
//* Source: https://stackoverflow.com/a/17772086
[
	'Array',	//* <- matches anything with 'Array' at the end, e.g. 'Uint8Array'
	'Blob',
	'CanvasElement',
	'Date',
	'Function',	//* <- matches anything with 'Function' at the end, e.g. 'AsyncFunction'
	'ImageData',
	'ImageElement',	//* <- matches anything with 'ImageElement' at the end, e.g. 'HTMLImageElement'
	'Number',
	'Promise',
	'RegExp',
	'SelectElement',
	'String',
].forEach(
	function (typeName) {
		window[
			'is' + typeName
		] = function (value) {
			return (toString.call(value).slice(-1 - typeName.length, -1) === typeName);
		};
	}
);

//* ---------------------------------------------------------------------------
//* Create common utility functions before using them in config:

const getFlatArray = (
	typeof Array.prototype.flat === 'function'

//* modern way:

	? (array, maxDepth) => Array.prototype.flat.call(array, isRealNumber(maxDepth) ? maxDepth : Infinity)

//* legacy way:

	: (array, maxDepth) => {
		if (!isRealNumber(maxDepth)) {
			maxDepth = Infinity;
		}

	let	flatArray = [];

		for (const value of array) {
			if (isArray(value)) {
				if (maxDepth > 0) {
					flatArray = flatArray.concat(getFlatArray(value, maxDepth - 1));
				} else {
					flatArray = flatArray.concat(value);
				}
			} else {
				flatArray.push(value);
			}
		}

		return flatArray;
	}
);

//* Config: internal, do not change *------------------------------------------

const	CONFIG_FILE_PATH = 'config.js'			//* <- declarations-only file to redefine any of the above variables
,	FETCH_TEST_FILE_PATH = 'index.png'		//* <- smallest local file to test loading from disk
,	LS_NAMESPACE = 'spriteDressUp'
,	LS_KEY_BIG_TEXT = LS_NAMESPACE + 'BigText'
,	LS_KEY_FIXED_TAB_WIDTH = LS_NAMESPACE + 'FixedTabWidth'

,	LS = window.localStorage || localStorage
,	URL = window.URL || window.webkitURL || URL
,	LANG = document.documentElement.lang || 'en'

,	RUNNING_FROM_DISK = isURLFromDisk('/')
,	CAN_USE_WORKERS = (typeof Worker === 'function' && !RUNNING_FROM_DISK)

,	pendingJobs = new Set()

,	regLayerNameParamOrComment = new RegExp(
		'^'
	+		'([^/\\[(]*)'			//* <- [1] layer identity names, e.g. "name1, name2"
	+		'('				//* <- [2] block of logic for any of identity names
	+			'/'			//* <- virtual subfolder, e.g. "parent names [parent param] / child names [child param]"
	+		'|' +	'\\[([^\\]]*)(?:\\]|$)'	//* <- [3] options, e.g. "name1 [param] name2"
	+		'|' +	'\\([^)]*(?:\\)|$)'	//* <- throwaway text, e.g. "name1 (comment) name2"
	+		')'
	+		'(.*?)'				//* <- [4] remainder for next step
	+	'$'
	)
,	regLayerNameToSkip	= null			//* <- old: /^(skip)$/i
,	regSplitLayerNames	= /[\/,]+/g
,	regSplitParam		= /[\s\r\n]+/g		//* <- old: /[\s,_]+/g
,	regTrimParam		= getTrimReg('\\s\\r\\n,_')
,	regTrimParamRadius	= /^(px|at)+|(px|at)+$/ig
,	regEndsWithNumPx	= /^(?:(.*?)\W+)?(\d+)px$/i
,	regColorCode		= /^(?:(rgba?)\W*|(hex)\W*|(#))(\w.*?)$/i

,	regLayerNameParamType = {
		'skip'		: /^(skip)$/i
	,	'skip_render'	: /^(skip|no)-(render)$/i
	,	'check_order'	: /^(?:(?:check|top|bottom)\W+)*(down|up)$/i	//* <- switch for speed/complexity testing, not useful
	,	'none'		: /^(none)$/i
	,	'if_only'	: /^(if|in)$/i
	,	'not'		: /^(\!|not?)$/i
	,	'any'		: /^(\?|any|some)$/i

	,	'copypaste'	: /^(copy|paste(?:-(?:above|below))?)(?:\W(.*))?$/i
	,	'color_code'	: regColorCode

	,	'colors'	: /^(colou?r)s$/i
	,	'parts'		: /^(option|part|type)s$/i

	,	'paddings'	: /^(outline|pad[ding]*)$/i
	,	'radius'	: /^(.*?\d.*)px(?:\W(.*))?$/i
	// ,	'wireframe'	: /^(?:wire\W*)?(frame|fill)$/i

	,	'opacities'	: /^(?:(?:opacit[yies]*)\W*)?(\d[^%]*)%(\d*)$/i
	,	'zoom'		: /^(?:(?:zoom|scale|x)\W*)(\d[^%]*)%(\d*)$/i

	,	'side'		: /^(front|back|reverse(?:\W(.*))?)$/i
	,	'separate'	: /^((?:separate|split)\w*)(?:-((e)?\w*))?(?:\W(.*))?$/i

	,	'autocrop'	: /^(autocrop)(?:\W(.*))?$/i
	,	'collage'	: /^(collage)(?:\W(.*))?$/i
	,	'layout'	: /^(?:(inline|rows)|(newline|columns))$/i

	,	'batch'		: /^(?:(single|no-batch)|(batch|batched))?$/i
	,	'prefix'	: /^(?:(prefix|prefixed)|(unprefixed|no-prefix))?$/i
	,	'option'	: /^(?:(omitable|(?:omit|no)-single(?:-name)?)|(unomitable|(?:add-|)single(?:-name)?))$/i

	,	'multi_select'	: /^(optional|required|x(\d[\d+-]*))$/i
	,	'preselect'	: /^(preselect|initial|(last))$/i
	}

,	regLayerBlendModePass	= /^pass[-through]*$/i
,	regLayerBlendModeAlpha	= /^(source|destination)-(\w+)$/i
,	regLayerTypeSingleTrim	= /s+$/i
,	regHasDigit		= /\d/
,	regFileExt		= /(\.)([^.]+)?$/
,	regMultiDot		= /\.\.+/g
,	regNumDots		= /[\d.]+/g
,	regNaNorDot		= /[^\d.]+/g
,	regNaN			= /\D+/g
,	regNonWord		= /\W+/g	//* <- "\w" includes underscore "_"
,	regNonAlphaNum		= /[^0-9a-z]+/gi
,	regNonHex		= /[^0-9a-f]+/gi
,	regSpace		= /\s+/g
,	regCommaSpace		= /\,+s*/g
,	regSanitizeFileName	= /[_\s\/\\:<>?*"]+/g
,	regTemplateVarName	= /\{(\w+)\}/g
,	regHMS			= /(T\d+)-(\d+)-(\d+\D*)/
,	regTrim			= getTrimReg('\\s')
,	regTrimBrackets		= getTrimReg('\\(\\)\\[\\]\\{\\}\\<\\>')
,	regTrimCommaSpace	= getTrimReg('\\s,')
,	regTrimNaN		= getTrimReg('\\D')
,	regTrimNaNorSign	= getTrimReg('^\\d\\.+-')
,	regTrimNewLine		= /[^\S\r\n]*(\r\n|\r|\n)/g
,	regTrimTailBrTags	= /(\<br\/\>\s*)+$/gi
,	regClassOption		= getClassReg('project-option', 'option')
,	regClassExampleFiles	= getClassReg('example-file-type', 'example-files', 'files')
,	regClassExampleFile	= getClassReg('example-file', 'file')
,	regClassLoadedFile	= getClassReg('loaded-file', 'file')
,	regClassMenuBar		= getClassReg('menu-bar')
,	regClassButton		= getClassReg('button')
,	regClassFailed		= getClassReg('failed')
,	regClassLoaded		= getClassReg('loaded')
,	regClassLoading		= getClassReg('loading')
,	regClassShow		= getClassReg('show')
,	regClassRow		= getClassReg('row')
,	regClassSub		= getClassReg('sub')

,	regJSONstringify = {
		'asFlatLine'	: /^(data)$/i
	,	'asFlatLines'	: /^(layers)$/i
	,	'skipByKey'	: /^(channels|parent|sourceData)$/i
	,	'skipByKeyIfLong' : /^(imageData)$/i
	,	'showFromTree'	: /^(layers|name)$/i
	}

const	SPLIT_SEC = 60
,	MIN_CHANNEL_VALUE = 0
,	MAX_CHANNEL_VALUE = 255
,	MAX_OPACITY = 255
,	MAX_BATCH_PRECOUNT = 9999

,	FLAG_FLIP_HORIZONTAL = 1
,	FLAG_FLIP_VERTICAL = 2

,	FLAG_EVENT_LISTENER_CAPTURE = {
		'capture' : true,
		'passive' : false,
	}

,	FLAG_EVENT_NO_DEFAULT = { 'preventDefault' : true }
,	FLAG_EVENT_STOP_IMMEDIATE = { 'stopImmediatePropagation' : true }
,	FLAG_EVENT_STOP_DEFAULT = {
		'preventDefault' : true,
		'stopImmediatePropagation' : true,
	}

,	FLAG_FILENAME_AS_KEY = { 'isForStorageKey' : true }
,	FLAG_FILENAME_TO_SAVE = {
		'checkSelectedValue' : true,
		'skipDefaultPercent' : true,
	}

,	FLAG_JOIN_TEXT_FILTER = { 'filter' : true }

,	FLAG_LAYER_PATH_TEXT = {
		'includeSelf' : true,
		'asText' : true,
	}

,	FLAG_PROJECT_SET_THUMBNAIL = { 'alsoSetThumbnail' : true }

,	FLAG_RENDER_LAYER_COPY = { 'isCopyNeeded' : true }
,	FLAG_RENDER_IGNORE_COLORS = { 'ignoreColors' : true }

,	FLAG_SAVE_ALL = { 'saveToFile' : true }
,	FLAG_SAVE_ZIP = { 'saveToZipFile' : true }
,	FLAG_SHOW_JOIN = { 'asOneJoinedImage' : true }
,	FLAG_SAVE_JOIN = {
		'saveToFile' : true,
		'asOneJoinedImage' : true,
	}

,	FLAG_TIME_LOG_FORMAT = { 'logFormat' : true }
,	FLAG_TIME_FILENAME_FORMAT = { 'fileNameFormat' : true }

,	DUMMY_EMPTY_ARRAY = Object.freeze( [] )		//* <- immutable, for skipping iteration on non-collectable results
,	DUMMY_NULL_ARRAY = Object.freeze( [null] )	//* <- immutable, for cross-product combinations
,	DUMMY_TEXT_ARRAY = Object.freeze( [''] )

,	DEFAULT_COLOR_VALUE_ARRAY = Object.freeze( [0,0,0,255] )
,	TRANSPARENT_COLOR_VALUE_ARRAY = Object.freeze( [0,0,0,0] )

,	DUMMY_OPTION_PARAMS = Object.freeze({
		'noOptionSwitches' : true,
		'skipInFileNames' : true,
		'preselect' : 'last',
	})

,	DUMMY_OPTIONAL_PARAMS = Object.freeze(
		Object.assign(
			{ 'optional' : true }
		,	DUMMY_OPTION_PARAMS
		)
	)

,	DUMMY_LAYER = Object.freeze({
		'name' : 'dummy',
		'names' : DUMMY_TEXT_ARRAY,
	})

,	FALSY_STRINGS = [
		'0'
	,	'no'
	,	'none'
	,	'null'
	,	'false'
	,	'hidden'
	,	'disabled'
	,	'undefined'
	]

,	DRAG_ORDER_PREFIX = 'drag-order:\n'
,	BLOB_PREFIX = 'blob:'
,	DATA_PREFIX = 'data:'
,	TYPE_TEXT = 'text/plain'
,	TITLE_LINE_BREAK = ' \r\n'
,	DOUBLE_LINE_BREAK = ' \r\n\r\n'
,	WIP_TEXT_ROLL = '\\|/-'

,	TIME_PARTS_YMD = ['FullYear', 'Month', 'Date']
,	TIME_PARTS_HMS = ['Hours', 'Minutes', 'Seconds']

,	QUERY_SELECTOR = {
		'getElementsByClassName' : ['.', ''],
		'getElementsByTagName'   : ['', ''],
		'getElementsByName' : ['*[name="', '"]'],
		'getElementsByType' : ['*[type="', '"]'],
		'getElementsById'   : ['*[id="', '"]'],
	}

,	BLEND_MODE_NORMAL = 'source-over'
,	BLEND_MODE_CLIP = 'source-atop'
,	BLEND_MODE_MASK = 'destination-in'
,	BLEND_MODE_CUT = 'destination-out'
,	BLEND_MODE_INVERT = 'source-out'
,	BLEND_MODE_ADD = 'lighter'
,	BLEND_MODE_PASS = 'pass'
,	BLEND_MODE_TRANSIT = 'transition'

,	BLEND_MODES_ALPHA_PREFIXES = ['source', 'destination', 'xor']

//* Source: https://www.w3.org/TR/SVGCompositing/#comp-op-property

,	BLEND_MODES_IN_SVG = [
		'clear'
	,	'src'
	,	'dst'
	,	'src-over'
	,	'dst-over'
	,	'src-in'
	,	'dst-in'
	,	'src-out'
	,	'dst-out'
	,	'src-atop'
	,	'dst-atop'
	,	'xor'
	,	'plus'
	,	'multiply'
	,	'screen'
	,	'overlay'
	,	'darken'
	,	'lighten'
	,	'color-dodge'
	,	'color-burn'
	,	'hard-light'
	,	'soft-light'
	,	'difference'
	,	'exclusion'
	,	'inherit'
	]

,	BLEND_MODES_REMAP_TO_ORA = {
		[ BLEND_MODE_ADD ] : 'plus'
	}

,	BLEND_MODES_REPLACE_TO_ORA = [
		['source', 'src']
	,	['destination', 'dst']
	,	[new RegExp('^(' + BLEND_MODES_IN_SVG.join('|') + ')$', 'i'), 'svg:$1']
	,	[/^([^:]+)$/, 'test:$1']
	]

,	BLEND_MODES_REPLACE = [
		['src', 'source']
	,	['dst', 'destination']
	,	['liner', 'linear']
	,	[/^.*:/g]		//* <- remove any "prefix:"
	,	[/[\s\/_-]+/g, '-']	//* <- normalize word separators to use only dashes
	,	[/^subs?tr[au]ct$/, 'subtract']
	,	[regLayerBlendModePass, BLEND_MODE_PASS]
	]

,	BLEND_MODES_REMAP = {
		'normal'	: BLEND_MODE_NORMAL
	,	'add'		: BLEND_MODE_ADD
	,	'plus'		: BLEND_MODE_ADD
	,	'linear-dodge'	: BLEND_MODE_ADD

//* From SAI2, remap according to PSD.js:

	,	'burn'		: 'color-burn'
	,	'burn-dodge'	: 'vivid-light'
	,	'darken-color'	: 'darker-color'
	,	'dodge'		: 'color-dodge'
	,	'exclude'	: 'exclusion'
	,	'lighten-color'	: 'lighter-color'
	,	'shade'		: 'linear-burn'
	,	'shade-shine'	: 'linear-light'
	,	'shine'		: BLEND_MODE_ADD
	}

,	BLEND_MODES_WITH_TS_VERSION = [
		BLEND_MODE_ADD
	,	'color-burn'
	,	'color-dodge'
	,	'difference'
	,	'hard-mix'
	,	'linear-burn'
	,	'linear-dodge'
	,	'linear-light'
	,	'vivid-light'
	]

//* Source: https://github.com/Braunbart/PSDLIB.js

,	PSD_COLOR_MODES = [
		'Bitmap'
	,	'Grayscale'
	,	'Indexed'
	,	'RGB'
	,	'CMYK'
	,	'HSL'
	,	'HSB'
	,	'Multichannel'
	,	'Duotone'
	,	'Lab'
	]

,	OPEN_CLOSE = ['open', 'close']

,	COLOR_LIST_NAMES = ['background']
,	PARAM_KEYWORDS_AUTOCROP = ['transparent', 'topleft', 'topright', 'bottomleft', 'bottomright']
,	PARAM_KEYWORDS_COLLAGE_ALIGN = ['topleft', 'topright', 'bottomleft', 'bottomright', 'top', 'bottom', 'left', 'right']
,	PARAM_KEYWORDS_COLLAGE_PAD = ['border', 'padding']
,	PARAM_KEYWORDS_PADDING_METHODS = ['max', 'min']
,	PARAM_KEYWORDS_SET_VALUE_TO_NAME = ['preselect']
,	PARAM_KEYWORDS_SET_VALUE_TO_TRUE = ['last', 'optional', 'required', 'no_prefix']
,	PARAM_KEYWORDS_SHORTCUT_FOR_ALL = ['all', 'etc']
,	PARAM_KEYWORDS_PASTE = ['paste', 'paste-above', 'paste-below']
,	PARAM_OPTIONS_FOR_EACH_NAME = ['opacities', 'paddings']
,	PARAM_OPTIONS_GLOBAL = ['autocrop', 'collage', 'separate', 'side', 'zoom']
,	PARAM_OPTIONS_LOCAL = ['parts', 'colors', 'paddings', 'opacities']
,	VIEW_SIDES = ['front', 'back']

,	SEPARATE_NAMING_TYPES = ['equal', 'numbered']
,	SEPARATE_PARAM_NAMES_DEFAULT = ['separate', 'split']
,	SEPARATE_GROUP_NAME_DEFAULT = ''

,	NAME_PARTS_PERCENTAGES = ['zoom', 'opacities']
,	NAME_PARTS_FOLDERS = ['parts', 'colors']
,	NAME_PARTS_ORDER = ['separate', 'side', 'parts', 'colors', 'paddings', 'opacities', 'zoom', 'autocrop']
,	NAME_PARTS_SEPARATOR = ''

,	PARAM_OPTIONS_ADD_BY_DEFAULT = {
		'collage'  : ['no-batch', 'last', 'optional', 'collage']
	,	'autocrop' : ['no-batch', 'last', 'optional', 'autocrop']
	}

,	SWITCH_LABEL_BY_CLASS = {
		'batch-batched'  : '[\u2E2C]'
	,	'batch-single'   : '[\u2E30]'
	,	'layout-inline'  : '[\u22EF]'
	,	'layout-newline' : '[\u22EE]'
	,	'option-omitable'   : '[\u2212]'
	,	'option-unomitable' : '[+]'
	,	'prefix-prefixed'   : '[=]'
	,	'prefix-unprefixed' : '[o]'
	}

,	SWITCH_CLASS_BY_INDEX = ['unchecked', 'checked']
,	SWITCH_NAMES_BY_TYPE = {
		'batch'  : ['single', 'batched']
	,	'layout' : ['inline', 'newline']
	,	'prefix' : ['prefixed', 'unprefixed']
	,	'option' : ['omitable', 'unomitable']
	}

,	SWITCH_NAMES_DEFAULT = {
		'batch'  : 'batched'
	,	'layout' : 'inline'
	,	'prefix' : 'prefixed'
	,	'option' : 'omitable'
	}

,	PROJECT_OPTION_GROUPS = [
		{
			'header' : 'option_header_collage',
			'select' : {
				'collage' : {
					'align' : 'option_collage_align',
					'background' : 'option_collage_background',
					'border' : 'option_collage_border',
					'padding' : 'option_collage_padding',
				},
			},
		},
		{
			'header' : 'option_header_separate',
			'select' : {
				'separate' : {
					'naming' : 'option_separate_naming',
					'group' : 'option_separate_group',
					'separate' : 'option_separate_part',
				},
			},
		},
		{
			'header' : 'option_header_view',
			'select' : {
				'autocrop' : 'option_autocrop',
				'zoom' : 'option_zoom',
				'side' : 'option_side',
			},
		},
		{
			'parts' : 'option_header_parts',
			'opacities' : 'option_header_opacities',
			'paddings' : 'option_header_paddings',
			'colors' : 'option_header_colors',
		},
	]

,	EXAMPLE_CONTROLS = [
		{
			'download_all' : 'download_all',
			'load_all' : 'open_example_all',
		},
		{
			'stop' : 'stop',
		},
	]

,	PROJECT_FILE_CONTROLS = [
		'show_project_details',
	]

,	PROJECT_SAVE_ALL_BUTTON_NAMES = [
		'show_all',
		'save_all',
		'save_zip',
	]

,	PROJECT_VIEW_CONTROLS = [
		/*{
			'header' : 'original_view_header',
			'buttons' : {
				'show_original' : 'show_original_png',
				'save_original' : 'save_original_png',
				'save_original_ora' : 'save_original_ora',
			},
		},*/
		{
			'header' : 'current_view_header',
			'buttons' : {
				'show' : 'show_png',
				'save' : 'save_png',
				'save_ora' : 'save_ora',
			},
		},
		{
			'header' : 'batch_view_header',
			'buttons' : {
				'batch' : {
					'show_all' : 'show_png_batch',
					'save_all' : 'save_png_batch',
					'save_zip' : 'save_png_batch_zip',
				},
				'collage' : {
					'show_join' : 'show_png_collage',
					'save_join' : 'save_png_collage',
					'stop' : 'stop',
				},
				// 'stop' : 'stop',
			},
		},
		{
			'header' : 'reset_header',
			'buttons' : {
				'options' : {
					'reset_options_to_init' : '',
					'reset_options_to_top' : '',
					'reset_options_to_bottom' : '',
					'reset_options_to_empty' : '',
				},
				'batching' : {
					'reset_switch_batch_to_batched' : '',
					'reset_switch_batch_to_single' : '',
					'reset_switch_layout_to_inline' : '',
					'reset_switch_layout_to_newline' : '',
				},
				'naming' : {
					'reset_switch_option_to_unomitable' : '',
					'reset_switch_option_to_omitable' : '',
					'reset_switch_prefix_to_prefixed' : '',
					'reset_switch_prefix_to_unprefixed' : '',
				},
			},
		},
	]

,	PROJECT_NAMING_BUTTON_NAMES = [
		'saved_file_naming_change',
		// 'saved_file_naming_reset_to_initial',
		// 'saved_file_naming_reset_to_default',
		'saved_file_naming_close',
	]

,	PROJECT_NAMING_EVENT_HANDLERS = {
		'dragstart' :	onPanelDragStart,
		'dragenter' :	onPanelDragMove,
		'drop' :	onPanelDragMove,
	}

,	PROJECT_CONTROL_TAGNAMES = [
		'button',
		'select',
		'input',
	]

,	IMAGE_GEOMETRY_KEYS = [
		['top', 'y'],
		['left', 'x'],
		['width', 'w'],
		['height', 'h'],
	]

,	VIRTUAL_FOLDER_TAKEOVER_PROPERTIES = {
		'blendMode' : BLEND_MODE_NORMAL,
		'isBlendModeTS' : false,
		'isClipped' : false,
	}

,	IMAGE_DATA_KEYS_TO_LOAD = [
		'toImage',
		'loadImage',
		'pixelData',
		'maskData',
		'imgData',
	]

,	CLEANUP_CHILD_KEYS = ['layers']

,	CLEANUP_KEYS_TESTING = [
		'loading',
		// 'loadImage',	//* <- keep for lazy-loading
		'toPng',
	]

,	CLEANUP_KEYS = CLEANUP_KEYS_TESTING.concat([
		'blendModeOriginal',
		'blendModeOriginalAlpha',
		'blendModeOriginalColor',
		// 'nameOriginal',
		'sourceData',
		'pixelData',
		'maskData',
		// 'imgData',	//* <- keep for lazy-loading
	])

//* Config: internal, included scripts and loaders of project files *----------

const	LIB_ROOT_DIR = 'lib/'
,	LIB_FORMATS_DIR = LIB_ROOT_DIR + 'formats/'
,	LIB_LANG_DIR = LIB_ROOT_DIR + 'localization/'
,	LIB_UTIL_DIR = LIB_ROOT_DIR + 'util/'

,	ZIP_FORMAT_DIR = LIB_FORMATS_DIR + 'zip/zip_js/'
,	ZLIB_ASM_DIR = LIB_FORMATS_DIR + 'zlib/zlib-asm/v0.2.2/'	//* <- last version supported by zip.js, ~ x2 faster than default
,	ZLIB_PAKO_DIR = LIB_FORMATS_DIR + 'zlib/pako/v2.0.2/'	//* <- good and fast enough for everything
	;

//* To be figured on the go *--------------------------------------------------

var	ora, zip, zlib, pako, PSD, UPNG, UZIP	//* <- external variable names, do not change

,	PSD_JS
,	CompositionModule
,	CompositionFuncList

,	FILE_TYPE_LIBS
,	FILE_TYPE_LOADERS
,	ZIP_WORKER_SCRIPTS

,	DEFAULT_COLLAGE
,	PRELOAD_LAYER_IMAGES
,	USE_ES5_JS
,	USE_WORKERS_IF_CAN

,	draggedElement
,	thumbnailPlaceholder
,	isStopRequested
,	isBatchWIP
,	lastTimeProjectTabSelectedByUser = 0
	;

//* Config: internal, wrapped to be called after reading external config *-----

function initLibParams() {
	USE_WORKERS_IF_CAN = (USE_WORKERS && CAN_USE_WORKERS);

const	zlibCodecPNG = [USE_UZIP ? 'UZIP.js' : 'pako'];
const	zlibCodecZIP = [USE_ZLIB_ASM ? 'zlib-asm' : 'pako'];

const	zipAllInOneFileName = 'z-worker-copy-all-in-one-file' + (
		!USE_ZLIB_CODECS
		? ''
		: USE_ZLIB_ASM
		? '-zlib-asm'
		: USE_ES5_JS
		? '-pako.es5'
		: '-pako'
	) + '.js';

const	zipZlibCodecWrapper = (
		USE_ZLIB_ASM
		? 'codecs-zlib-asm.js'
		: 'codecs-pako.js'
	);

const	zlibPakoFileName = (
		'pako'
	+	(USE_ES5_JS ? '.es5' : '')
	+	(USE_MINIFIED_JS ? '.min' : '')
	+	'.js'
	);

	FILE_TYPE_LIBS = {
		'zlib-asm' : {

//* Source: https://github.com/ukyo/zlib-asm

			'varName' : 'zlib'
		,	'dir' : ZLIB_ASM_DIR
		,	'files' : ['zlib.js']
		},

		'pako' : {

//* Source: https://github.com/nodeca/pako

			'varName' : 'pako'
		,	'dir' : ZLIB_PAKO_DIR
		,	'files' : [zlibPakoFileName]
		},

		'UZIP.js' : {

//* Source: https://github.com/photopea/UZIP.js

			'varName' : 'UZIP'
		,	'dir' : LIB_FORMATS_DIR + 'zlib/UZIP/'
		,	'files' : ['UZIP.js']
		,	'depends' : ['pako']
		},

		'UPNG.js' : {

//* Source: https://github.com/photopea/UPNG.js

			'varName' : 'UPNG'
		,	'dir' : LIB_FORMATS_DIR + 'png/UPNG/'
		,	'files' : ['UPNG.js']
		,	'depends' : zlibCodecPNG
		},

		'zip.js' : {

//* Source: https://github.com/gildas-lormeau/zip.js

			'varName' : 'zip'
		,	'dir' : ZIP_FORMAT_DIR
		,	'files' : [
				'zip.js',
				'zip-fs.js',
			].concat(
				USE_WORKERS_IF_CAN
				? DUMMY_EMPTY_ARRAY
				:

//* CORS workaround: when not using Workers, include scripts here.
//* Source: https://github.com/gildas-lormeau/zip.js/issues/169#issuecomment-312110395

				USE_ONE_FILE_ZIP_WORKER
				? [zipAllInOneFileName]
				:
				USE_ZLIB_CODECS
				? [zipZlibCodecWrapper]
				: [
					'deflate.js',
					'inflate.js',
				]
			)
		,	'depends' : (
				USE_WORKERS_IF_CAN
			||	USE_ONE_FILE_ZIP_WORKER
			||	!USE_ZLIB_CODECS
				? DUMMY_EMPTY_ARRAY
				: zlibCodecZIP
			)
		},

		'ora.js' : {

//* Source: https://github.com/zsgalusz/ora.js

//* No support for ORA in CSP, SAI, etc.
//* Not enough supported features in Krita, etc.

//* Way: draw in SAI2 → export PSD → import PSD in Krita (loses clipping groups) → export ORA (loses opacity masks)
//* Wish: draw in SAI2 → export ORA (all layers rasterized + all blending properties and modes included as attributes)

			'varName' : 'ora'
		,	'dir' : LIB_FORMATS_DIR + 'ora/ora_js/'
		,	'files' : ['ora.js']
		,	'depends' : ['zip.js']
		},

		'psd.js' : {

//* Source: https://github.com/meltingice/psd.js/issues/154#issuecomment-446279652
//* Based on https://github.com/layervault/psd.rb

			'varName' : 'PSD_JS'
		,	'dir' : LIB_FORMATS_DIR + 'psd/psd_js/psd.js_build_by_rtf-const_2018-12-11/'	//* <- working with bigger files?
		,	'files' : ['psd.js']
		},

		'psd.browser.js' : {

//* Source: https://github.com/imcuttle/psd.js/tree/release
//* Fork of https://github.com/meltingice/psd.js

			'varName' : 'PSD'
		,	'dir' : LIB_FORMATS_DIR + 'psd/psd_js/psd.js_fork_by_imcuttle_2018-09-19/'		//* <- working here
		,	'files' : ['psd.browser.js']
		},
	};

	ZIP_WORKER_SCRIPTS = (
		USE_ONE_FILE_ZIP_WORKER
		? [
			ZIP_FORMAT_DIR + zipAllInOneFileName
		]
		: USE_ZLIB_CODECS
		? [
			ZIP_FORMAT_DIR + 'z-worker.js',
			ZIP_FORMAT_DIR + zipZlibCodecWrapper,
		].concat(
			zlibCodecZIP.map(
				(libName) => FILE_TYPE_LIBS[libName].files.map(
					(fileName) => FILE_TYPE_LIBS[libName].dir + fileName
				)
			)
		)
		: null
	);

	FILE_TYPE_LOADERS = [
		{
			'dropFileExts' : ['ora', 'zip']
		,	'inputFileAcceptMimeTypes' : ['image/openraster', 'application/zip']
		,	'handlerFuncs' : [
				loadORA,
			]
		},
		{
			'dropFileExts' : ['psd']
		,	'inputFileAcceptMimeTypes' : ['image/x-photoshop', 'image/vnd.adobe.photoshop']
		,	'handlerFuncs' : [
				loadPSD,
				// loadPSDBrowser,	//* <- second parser is only needed if it could success on different files
			]
		},
	];
}

//* Common utility functions *-------------------------------------------------

function asArray(value) { return ( isArray(value) ? value : [value] ); }
function asFlatArray(value) { return getFlatArray(asArray(value || [])); }
function arrayFromObjectEntriesSortByKey(a, b) { return ( a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0 ); }

const toggleClass = (
	typeof document.documentElement.classList === 'undefined'

//* legacy way:

	? (element, className, keep) => {
	const	oldText = element.className || element.getAttribute('class') || '';
	const	classNames = oldText.split(regSpace).filter(arrayFilterNonEmptyValues);
	const	index = classNames.indexOf(className);

		if (index < 0) {
			if (keep >= 0) classNames.push(className);
		} else {
			if (keep <= 0) classNames.splice(index, 1);
		}

		if (classNames.length > 0) {
		const	newText = classNames.join(' ');
			if (oldText !== newText) element.className = newText;
		} else
		if (oldText) {
			element.className = '';
			element.removeAttribute('class');
		}

		return classNames.includes(className);
	}

//* modern way:

	: (element, className, keep) => {
		if (keep > 0) {
			element.classList.add(className);
		} else
		if (keep < 0) {
			element.classList.remove(className);
		} else {
			element.classList.toggle(className);
		}

		return element.classList.contains(className);
	}
);

function isNonEmptyArray(value) {
	return (
		isArray(value)
	&&	value.length > 0
	);
}

function isRealNumber(value) {
	return (
		isNumber(value)
	&&	!isNaN(value)
	);
}

function isNonNullObject(value) {
	return (
		value !== null
	&&	typeof value === 'object'
	);
}

function isNonNullImageData(imageData) {
	return (
		isNonNullObject(imageData)
	&&	imageData.data
	&&	imageData.data.length > 0
	&&	imageData.width > 0
	&&	imageData.height > 0
	);
}

function isURLFromDisk(url) {
const	match = String(url).match(/^(\w+):(\/\/|$)/);
const	protocol = (
		(
			match
			? match[1]
			: location.protocol
		)
		.split(':', 1)[0]
		.toLowerCase()
	);

	return (protocol === 'file');
}

//* Source: https://stackoverflow.com/a/55896125
function isImageTypeExportSupported(type) {
const	canvas = cre('canvas');
	canvas.width = 1;
	canvas.height = 1;

	return (
		canvas
		.toDataURL(type)
		.includes(DATA_PREFIX + type)
	);
}

function getTrimReg(chars) {
	return new RegExp('^[' + chars + ']+|[' + chars + ']+$', 'gi');
}

function getClassReg(...words) {
	return (
		isRegExp(arguments[0])
		? arguments[0]
		: new RegExp('(^|\\s)(' + getFlatArray(words).join('|') + ')($|\\s)', 'i')
	);
}

/*
//* Source: https://cwestblog.com/2011/05/02/cartesian-product-of-multiple-arrays/
//* Description:
//*	Get array of all possible combinations of values from multiple arrays.
//* Usage example:
//*	var combos = getCrossProductArray( array, array, ... );
//*	var combo = combos[123];
//*	var count = combos.length;
function getCrossProductArray() {
	return Array.prototype.reduce.call(
		arguments
	,	(a, b) => {
		const	result = [];

			for (const ai of a)
			for (const bi of b) {
				result.push(ai.concat([bi]));
			}

			return result;
		}
	,	[[]]
	);
}

//* Shorter version, Source: https://stackoverflow.com/a/43053803
const getCrossProductSub = (a, b) => [].concat(...a.map(d => b.map(e => [].concat(d, e))));
const getCrossProductArr = (a, b, ...c) => (b ? getCrossProductArr(getCrossProductSub(a, b), ...c) : a);

//* Source: http://phrogz.net/lazy-cartesian-product
//* Description:
//*	Construct lazy iterator for all possible combinations without saving them all beforehand.
//* Usage example:
//*	var combos = new CrossProductIterator( array, array, ... );
//*	var combo = combos.item(123);
//*	var count = combos.length;
function CrossProductIterator() {
const	dimensions = [];
let	totalCount = 1;

	for (
	let	subCount = 0
	,	argIndex = arguments.length;
		argIndex--;
		totalCount *= subCount
	) {
		dimensions[argIndex] = [
			totalCount
		,	subCount = arguments[argIndex].length
		];
	}

	this.length = totalCount;

	this.item = (comboIndex) => {
	const	combo = [];

		for (
		let	argIndex = arguments.length;
			argIndex--;
		) {
			combo[argIndex] = arguments[argIndex][(comboIndex / dimensions[argIndex][0] << 0) % dimensions[argIndex][1]];
		}

		return combo;
	};
}

//* Source: http://phrogz.net/lazy-cartesian-product
//* Description:
//*	Iterate through all possible combinations without saving them all, until stopped.
//*	Combination array becomes arguments for callback.
//*	Stops on the first truthy result from callback.
//*	Returns true if it was stopped.
//* Usage example:
//*	forEachSetInCrossProductUntilStopped( [array, array, ...], (combo) => combo.includes('stop') );
function forEachSetInCrossProductUntilStopped(arrays, callback, thisContext) {

	function goDeeper(arrayIndex) {
	const	variants = arrays[arrayIndex];
	const	count = counts[arrayIndex];

		if (arrayIndex === lastArrayIndex) {
			for (let i = 0; i < count; ++i) {
				combo[arrayIndex] = variants[i];

				if (callback.apply(thisContext, combo)) {
					return true;
				}
			}
		} else {
			for (let i = 0; i < count; ++i) {
				combo[arrayIndex] = variants[i];

				if (goDeeper(arrayIndex + 1)) {
					return true;
				}
			}
		}

		combo.pop();

		return false;
	}

	if (!thisContext) {
		thisContext = this;
	}

const	lastArrayIndex = arrays.length - 1;
const	combo = [];
const	counts = [];

	for (let i = arrays.length; i--; ) {
		counts[i] = arrays[i].length;
	}

	return goDeeper(0);
}
*/

//* Source: http://phrogz.net/lazy-cartesian-product
//* Description:
//*	Iterate through all possible combinations without saving them all.
//*	Combination array becomes arguments for callback.
//* Usage example:
//*	forEachSetInCrossProduct( [array, array, ...], console.log );
function forEachSetInCrossProduct(arrays, callback, thisContext) {

	function goDeeper(arrayIndex) {
	const	variants = arrays[arrayIndex];
	const	count = counts[arrayIndex];

		if (arrayIndex === lastArrayIndex) {
			for (let i = 0; i < count; ++i) {
				combo[arrayIndex] = variants[i];
				callback.apply(thisContext, combo);
			}
		} else {
			for (let i = 0; i < count; ++i) {
				combo[arrayIndex] = variants[i];
				goDeeper(arrayIndex + 1);
			}
		}

		combo.pop();
	}

	if (!thisContext) {
		thisContext = this;
	}

const	lastArrayIndex = arrays.length - 1;
const	combo = [];
const	counts = [];

	for (let i = arrays.length; i--; ) {
		counts[i] = arrays[i].length;
	}

	goDeeper(0);
}

function arrayFillRepeat(dest, src) {
const	srcLength = src.length;
let	destIndex = dest.length;

	if (destIndex === srcLength) {
		dest.set(src);
	} else {

//* Simple generic solution that works well:
//* Source: https://stackoverflow.com/a/30229089

		while (destIndex--) {
			dest[destIndex] = src[destIndex % srcLength];
		}
	}

	return dest;
}

function arrayFilterNonEmptyValues(value) {
	return (
		isString(value)
	||	(
			isNonNullObject(value)
		&&	typeof value.length !== 'undefined'
		)
		? (value.length > 0)
		: !!value
	);
}

function arrayFilterUniqueValues(value, index, array) { return (array.indexOf(value) === index); }
function orz(value) { return parseInt(value||0)||0; }
function orzClamp(value, min, max) { return Math.max(min, Math.min(max, orz(value))); }
function orzFloat(value) { return parseFloat(value||.0)||.0; }
function orzTrim(value) { return orz(String(value).replace(regTrimNaN, '')); }

function getDistance(x,y) { return Math.sqrt(x*x + y*y); }
function getAlphaDataIndex(x,y, width) { return (((y*width + x) << 2) | 3); } // { return (((y*width + x) * 4) + 3); }
function repeatText(text, numberOfTimes) { return (new Array(numberOfTimes + 1)).join(text); }

function replaceAll(text, replaceWhat, replaceWith) {
	if (isArray(replaceWhat)) {
		for (const arg of arguments) if (isArray(arg)) {
			text = replaceAll(text, ...arg);
		}

		return text;
	}

	return String(text).split(replaceWhat).join(replaceWith);
}

function isNotEmptyString(value) {
	return (
		isString(value)
	&&	value.length > 0
	);
}

function isSlicableNotString(value) {
	return (
		!isString(value)
	&&	value
	&&	isFunction(value.slice)
	);
}

function hasPrefix(value, prefix) {
	return (
		prefix
	&&	prefix.length > 0
	&&	value
	&&	value.length >= prefix.length
	&&	value.slice
	&&	value.slice(0, prefix.length) === prefix
	);
}

function hasPostfix(value, postfix) {
	return (
		postfix
	&&	postfix.length > 0
	&&	value
	&&	value.length >= postfix.length
	&&	value.slice
	&&	value.slice(-postfix.length) === postfix
	);
}

function hasFraming(value, prefix, postfix) {
	return (
		hasPrefix(value, prefix)
	&&	hasPostfix(value, postfix || prefix)
	);
}

function addToListIfNotYet(values, value) {
	if (values.includes(value)) {
		return 0;
	}

	values.push(value);

	return 1;
}

function addRangeToList(values, newValuesText) {
	for (const rangeText of (
		String(newValuesText)
		.split(regCommaSpace)
	)) {
	const	range = (
			String(rangeText)
			.split(regMultiDot)
			.map((textPart) => textPart.replace(regTrimNaNorSign, ''))
			.filter(arrayFilterNonEmptyValues)
			.map(orzFloat)
		);

		if (range.length > 0) {
		const	min = Math.min(...range);
		const	max = Math.max(...range);
		const	isCountDown = range.indexOf(min) > range.indexOf(max);

			if (
				!values
			||	!isFunction(values.push)
			) {
				values = [];
			}

			if (isCountDown) {
				for (let value = max; value >= min; --value) {
					addToListIfNotYet(values, value);
				}
			} else {
				for (let value = min; value <= max; ++value) {
					addToListIfNotYet(values, value);
				}
			}

	//* don't forget overstepped floats:

			addToListIfNotYet(values, min);
			addToListIfNotYet(values, max);
		}
	}

	return values;
}

function getRangeValuesFromText(rangeText) {
	return addRangeToList([], rangeText);
}

function getThisOrAnyNonEmptyItem(value, index, values) {
	if (value) {
		return value;
	}

let	foundValue = undefined;

	if (
		(
			(isNumber(index) || isString(index))
		&&	(foundValue = value[index])
		) || (
			isFunction(values.find)
		&&	(foundValue = values.find((value) => !!value))
		) || (
			isFunction(index.find)
		&&	(foundValue = index.find((value) => !!value))
		)
	) {
		return foundValue;
	}
}

function getJoinedOrEmptyText(text, joinText) {
	return (
		typeof text === 'undefined'
	||	text === null
		? '' :
		(
			text
		&&	isFunction(text.join)
			? text.join(
				typeof joinText === 'undefined'
			||	joinText === null
				? '\n'
				: joinText
			)
			: String(text)
		)
	);
}

function getNestedJoinedText(value, ...joinTexts) {
	return getNestedArrayJoinedText(value, null, ...joinTexts);
}

function getNestedFilteredArrayJoinedText(value, ...joinTexts) {
	return getNestedArrayJoinedText(value, FLAG_JOIN_TEXT_FILTER, ...joinTexts);
}

function getNestedFilteredArrayEnclosedJoinedText(value, prefix, suffix, ...joinTexts) {
	return getNestedArrayJoinedText(value, { prefix, suffix, 'filter' : true }, ...joinTexts);
}

function getNestedArrayJoinedText(value, flags, ...joinTexts) {
	if (!isNonNullObject(flags)) {
		flags = {};
	}

	if (!isArray(joinTexts) || !joinTexts.length) {
		joinTexts = [''];
	}

const	wrapText = {
		'prefix' : '',
		'suffix' : '',
	};

	for (const key in wrapText) if (key in flags) {
		wrapText[key] = String(flags[key]);

		delete flags[key];
	}

	if (isArray(value)) {
	const	joinText = (
			joinTexts.length > 1
			? joinTexts.shift()
			: joinTexts[0]
		) || '';

		value = value.map(
			(value) => getNestedArrayJoinedText(value, flags, ...joinTexts)
		);

		if (flags.filter) {
			value = value.filter(arrayFilterNonEmptyValues);
		}

		value = value.join(joinText);
	}

	return (
		wrapText.prefix
	+	String(value)
	+	wrapText.suffix
	);
}

function getLocalizedKeyOrNull(key) {
	key = String(key);

	if (key in LOCALIZATION_TEXT) {
		return key;
	}

const	lowKey = key.toLowerCase();

	if (lowKey in LOCALIZATION_TEXT) {
		return lowKey;
	}

	return null;
}

function getLocalizedKeyByCount(key, ...args) {
	key = String(key);

	if (
		(args.length > 0)
	&&	isFunction(getLocalizedCaseByCount)
	) {
	const	finalCount = (
			LOCALIZED_CASE_BY_CROSS_COUNT
			? args.reduce(
				(result, arg) => (
					isRealNumber(arg)
					? arg * (isRealNumber(result) ? result : 1)
					: result
				)
			,	undefined
			)
			: args.reduce(
				(result, arg) => (
					isRealNumber(arg)
					? arg
					: result
				)
			,	undefined
			)
		);

	const	keyCase = getLocalizedCaseByCount(finalCount);
	const	keyByCase = getLocalizedKeyOrNull(key + '_' + keyCase);

		if (keyByCase !== null) {
			return keyByCase;
		}
	}

	return getLocalizedKeyOrNull(key);
}

function getLocalizedOrDefaultText(key, defaultText, ...replacements) {

	function replaceKeyword(placeholder, replacement) {
		text = replaceAll(text, placeholder, getNestedJoinedText(replacement, '\n', ''));
	}

const	foundKey = getLocalizedKeyByCount(key, ...replacements);
let	text = getJoinedOrEmptyText(
		foundKey !== null
		? LOCALIZATION_TEXT[foundKey]
		: (
			defaultText === true
			? getNestedJoinedText(key, '\n', '')
			: defaultText
		)
	);

	if (
		text
	&&	isArray(replacements)
	) {
		replacements.forEach(
			(value, index) => replaceKeyword('{' + index + '}', value)
		);
	}

	if (
		text
	&&	(replacements = text.match(regTemplateVarName))
	) {
		for (const placeholder of replacements) {
		const	keyword = placeholder.replace(regTrimBrackets, '');

			if (keyword.length > 0) {
				if (keyword in LOCALIZATION_TEXT) {
					replaceKeyword(placeholder, LOCALIZATION_TEXT[keyword]);
				} else
				if (keyword in window) {
					replaceKeyword(placeholder, window[keyword]);
				}
			}
		}
	}

	return text;
}

function getLocalizedOrEmptyText(key, ...replacements) {
	return getLocalizedOrDefaultText(key, '', ...replacements);
}

function getLocalizedText(key, ...replacements) {
	return getLocalizedOrDefaultText(key, true, ...replacements);
}

function getLocalizedHTML() {
	return replaceAll(getLocalizedText(...arguments), '\n', '<br>');
}

function trim(text) {
	return (
		getJoinedOrEmptyText(text)
		.replace(regTrim, '')
		.replace(regTrimNewLine, '\n')
	);
}

function pause(msec) {
	return new Promise(resolve => setTimeout(resolve, msec));
}

function eventStop(evt, flags) {
	if (
		(
			isNonNullObject(evt)
		&&	typeof evt.eventPhase !== 'undefined'
		&&	evt.eventPhase !== null
		)
		? evt
		: (evt = window.event)
	) {
		if (!isNonNullObject(flags)) {
			flags = {};
		}

		if (evt.cancelBubble !== null) evt.cancelBubble = true;
		if (evt.stopPropagation) evt.stopPropagation();

		for (const key in flags)
		if (
			flags[key]
		&&	isFunction(evt[key])
		) {
			evt[key]();
		}
	}

	return evt;
}

function catchPromiseError(error) {
	console.error('Promise failed:', error);

	return null;
}

function getErrorFromEvent(evt, message, callback) {
const	error = new Error(message || 'Unknown error.');
	error.event = evt;

	if (isFunction(callback)) {
		callback(error);
	}

	return error;
}

function getNormalizedColorText(color) {
	return (
		String(color)
		.replace(regNonAlphaNum, '')
		.toLowerCase()
	);
}

function getRGBACutOrPadded(rgbaSource, rgbaDefault) {
	return (
		rgbaSource.length >= 4
		? rgbaSource.slice(0,4)
		: rgbaSource.concat(rgbaDefault.slice(rgbaSource.length))
	);
}

function getRGBAFromHex(text) {

//* extend shortcut notation:

	text = String(text).replace(regNonHex, '');

const	charsNum = text.length;

	if (charsNum === 1) text = repeatText(text, 6); else	//* #1 -> #111111
	if (charsNum === 2) text = repeatText(text, 3); else	//* #12 -> #121212
	if (charsNum === 3 || charsNum === 4) {
		text = (
			text
			.split('')
			.map((char) => repeatText(char, 2))	//* #123(4) -> #112233(44)
			.join('')
		);
	}

//* parse string into array of up to 4 numbers, taking up to 2 chars from left at each step:

const	rgba = DEFAULT_COLOR_VALUE_ARRAY.slice();

	for (
	let	index = 0;
		index < rgba.length && text.length > 0;
		index++
	) {
	const	charsNum = Math.min(2, text.length);
		rgba[index] = parseInt(text.substr(0, charsNum), 16);
		text = text.substr(charsNum);
	}

	return rgba;
}

function getRGBAFromColorCodeMatch(match) {
const	rgba = DEFAULT_COLOR_VALUE_ARRAY.slice();

//* split RGB(A):

	if (match[1]) {
		getNumbersArray(match[4], 4).forEach(
			(channelValue, index) => (rgba[index] = channelValue)
		);
	} else

//* split hex:

	if (match[2]) {
		getNumbersArray(match[4], 4, regNonHex,
			(channelValue) => parseInt(channelValue.substr(0, 2), 16)
		).forEach(
			(channelValue, index) => (rgba[index] = channelValue)
		);
	} else

//* solid hex:

	if (match[3]) {
		getRGBAFromHex(match[4]).forEach(
			(channelValue, index) => (rgba[index] = channelValue)
		);
	}

	return getNormalizedRGBA(rgba);
}

function getRGBAFromColorCodeText(color) {
const	match = String(color).match(regColorCode);

	if (match) {
		return getRGBAFromColorCodeMatch(match);
	}
}

function getRGBAFromColorCodeOrName(color, maxCount) {
let	rgba = getRGBAFromColorCodeText(color);

	if (rgba) {
		return rgba;
	}

//* ask browser built-in API what a color word means:

const	canvas = cre('canvas');
const	ctx = canvas.getContext('2d');
const	normalizedColorText = getNormalizedColorText(color);

	canvas.width = 1;
	canvas.height = 1;
	ctx.fillStyle = 'transparent';
	ctx.fillStyle = normalizedColorText;

let	rgbaFromCanvas;

	if (
		normalizedColorText === 'transparent'
	||	(
			(rgbaFromCanvas = getRGBAFromColorCodeText(ctx.fillStyle))
		&&	!isColorTransparent(rgbaFromCanvas)
		)
	) {
		ctx.fillRect(0,0, 1,1);

		maxCount = orzClamp(maxCount || 4, 3,4);
		rgba = Array.from(ctx.getImageData(0,0, 1,1).data.slice(0, maxCount));

		return getNormalizedRGBA(rgba);
	} else {
		if (TESTING) console.log(
			'getRGBAFromColorCodeOrName - unknown color: "'
		+		color
		+	'" ('
		+		normalizedColorText
		+	'), canvas result = "'
		+		ctx.fillStyle
		+	'"'
		);
	}
}

function getRGBAFromColorCodeOrArray(color, maxCount) {
	maxCount = orzClamp(maxCount || 4, 3,4);

	return (
		isSlicableNotString(color)
		? getNumbersArray(color, maxCount)
		: getRGBAFromColorCodeOrName(color, maxCount)
	);
}

function isColorDark(color) {
const	[ r,g,b ] = getRGBAFromColorCodeOrArray(color, 3);

//* sources:
//* https://awik.io/determine-color-bright-dark-using-javascript/
//* http://alienryderflex.com/hsp.html

	return Math.sqrt(
		0.299 * r * r
	+	0.587 * g * g
	+	0.114 * b * b
	) < 150;
}

function isColorTransparent(color) {
	if (getNormalizedColorText(color) === 'transparent') {
		return true;
	}

const	rgba = getRGBAFromColorCodeOrArray(color);

	return (
		rgba
	&&	isArray(rgba)
	&&	!(
			rgba.length === 3
		||	rgba.some((channelValue) => (channelValue > 0))
		)
	);
}

function getNormalizedRGBA(rgba) {
	if (rgba.length > 3) {
		if (rgba[3] === 255) {
			return rgba.slice(0,3);
		}

		if (rgba[3] === 0) {
			return TRANSPARENT_COLOR_VALUE_ARRAY.slice();
		}
	}

	return rgba;
}

function getColorTextFromArray(rgba, maxCount) {
	if (
		rgba
	&&	rgba.slice
	&&	!isString(rgba)
	) {
		rgba = rgba.slice(0, orzClamp(maxCount || 4, 1,4)).map(
			(channelValue, index) => (
				index === 3
				? getNormalizedOpacity(channelValue).toFixed(3)
				: orz(channelValue)
			)
		);

		while (rgba.length < 3) {
			rgba.push(0);
		}

		return (
			(rgba.length < 4 ? 'rgb' : 'rgba')
		+	'('
		+		rgba.join(', ')
		+	')'
		);
	}

	return String(rgba);
}

//* Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#Deep_Clone
function getPatchedObject(obj, jsonReplacerFunc) {
	return JSON.parse(JSON.stringify(obj, jsonReplacerFunc || null));
}

//* Source: https://stackoverflow.com/a/53593328
function orderedJSONstringify(obj, space) {
const	allKeys = [];

	JSON.stringify(
		obj
	,	(key, value) => {
			allKeys.push(key);
			return value;
		}
	);

	allKeys.sort();

	return JSON.stringify(obj, allKeys, space);
}

function getOrInitChild(obj, key, ...args) {

	function getInitChild(args) {
	const	constructor = args.find(isFunction) || Object;
	const	keys = args.filter(isString);

		if (keys.length > 0) {
		const	child = {};

			while (keys.length > 0) {
			const	key = keys.shift();
				child[key] = new constructor();
			}

			return child;
		} else {
			return new constructor();
		}
	}

	if (!isNonNullObject(obj)) {
		return;
	}

	return (
		key in obj
		? obj[key]
		: (obj[key] = getInitChild(args))
	);
}

function getPropFromAnySource(key, ...sources) {
	for (const obj of sources)
	if (
		isNonNullObject(obj)
	&&	key in obj
	) {
		return obj[key];
	}

	return null;
}

function getPropByNameChain(obj, ...keys) {
	while (keys.length > 0) {
	const	key = keys.shift();

		if (
			typeof key === 'undefined'
		||	!isNonNullObject(obj)
		) {
			return null;
		}

		obj = obj[key];
	}

	return obj;
}

function getPropByAnyOfNamesChain(obj, ...keys) {
	deeper:
	while (isNonNullObject(obj)) {

		for (const key of keys) if (key in obj) {
			obj = obj[key];

			continue deeper;
		}

		break;
	}

	return obj;
}

function getPropBySameNameChain(obj, key) {
	while (
		isNonNullObject(obj)
	&&	key in obj
	) {
		obj = obj[key];
	}

	return obj;
}

function cleanupObjectTree(obj, childKeys, keysToRemove) {
	if (isNonNullObject(obj)) {

		for (const key of keysToRemove) if (key in obj) {

			obj[key] = null;
			delete obj[key];
		}

	let	child;

		for (const key of childKeys) if (child = obj[key]) {

			if (isArray(child)) {
				for (const item of child) {
					cleanupObjectTree(item, childKeys, keysToRemove);
				}
			} else {
				cleanupObjectTree(child, childKeys, keysToRemove);
			}
		}
	}

	return obj;
}

//* Source: https://gist.github.com/wellcaffeinated/5399067#gistcomment-1364265
function nextValidHeapSize(realSize) {
const	SIZE_64_KB = 65536;	// 0x10000
const	SIZE_64_MB = 67108864;	// 0x4000000

	if (realSize <= SIZE_64_KB) {
		return SIZE_64_KB;
	} else if (realSize <= SIZE_64_MB) {
		return 1 << (Math.ceil(Math.log(realSize)/Math.LN2)|0);
	} else {
		return (SIZE_64_MB*Math.ceil(realSize/SIZE_64_MB)|0)|0;
	}
}

//* This function must work even in older browsers, so extra care is taken:
function getElementsArray(by, text, parent) {
	if (!parent) {
		parent = document;
	}

	try {
	const	results = (
			isFunction(parent[by])
			? parent[by](text)
			: parent.querySelectorAll(QUERY_SELECTOR[by].join(text))
		) || DUMMY_EMPTY_ARRAY;

		return Array.prototype.slice.call(results);

	} catch (error) {
		logError(error, arguments);
	}

	return DUMMY_EMPTY_ARRAY;
}

function getAllByClass	(text, parent) { return getElementsArray('getElementsByClassName', text, parent); }
function getAllByTag	(text, parent) { return getElementsArray('getElementsByTagName', text, parent); }
function getAllByType	(text, parent) { return getElementsArray('getElementsByType', text, parent); }
function getAllByName	(text, parent) { return getElementsArray('getElementsByName', text, parent); }
function getAllById	(text, parent) { return getElementsArray('getElementsById', text, parent); }
function getOneById	(text) { return document.getElementById(text); }

function cre(tagName, parent, before) {
const	element = document.createElement(tagName);

	if (parent) {
		if (before) {
			parent.insertBefore(element, before);
		} else {
			parent.appendChild(element);
		}
	}

	return element;
}

function del(element) {
	if (!element) {
		return null;
	}

	if (element.target) {
		element = element.target;
	}

	if (isFunction(element.map)) {
		return element.map(del);
	}

const	parent = element.parentNode;

	if (parent) {
		parent.removeChild(element);

		return parent;
	}
}

function delAllChildNodes(parent) {
	while (del(parent.lastChild));

	return parent;
}

function encodeHTMLSpecialChars(text) {
	return (
		String(text)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
	);
}

function encodeTagAttr(text) {
	return (
		String(text)
		.replace(/"/g, '&quot;')
	);
}

function getCapitalizedString(text) { return text.slice(0,1).toUpperCase() + text.slice(1).toLowerCase(); }

//* propNameForIE:
function dashedToCamelCase(text) {
	return (
		String(text)
		.split('-')
		.map(
			(word, index) => (
				index === 0
				? word.toLowerCase()
				: getCapitalizedString(word)
			)
		)
		.join('')
	);
}

function getStyleValue(element, prop) {
let	helperObject;

	if (helperObject = element.currentStyle) {
		return helperObject[dashedToCamelCase(prop)];
	}

	if (helperObject = window.getComputedStyle) {
		return helperObject(element).getPropertyValue(prop);
	}

	return null;
}

function getChildByAttr(element, attrName, attrValue) {
	if (element) {
		element = element.firstElementChild;
	}

	while (element) {
		if (element.getAttribute(attrName) === attrValue) break;
		element = element.nextElementSibling;
	}

	return element;
}

function getDraggableElementOrParent(element) {
	while (element) {
		if (element.draggable) {
			return element;
		}

		element = element.parentNode;
	}
}

function isElementOrAnyParentDraggable(element) {
	while (element) {
		if (element.draggable) {
			return true;
		}

		element = element.parentNode;
	}

	return false;
}

function isElementAfterSibling(element, sibling) {
	while (element && (element = element.previousSibling)) {
		if (element === sibling) {
			return true;
		}
	}

	return false;
}

function isElementBeforeSibling(element, sibling) {
	while (element && (element = element.nextSibling)) {
		if (element === sibling) {
			return true;
		}
	}

	return false;
}

function getPreviousSiblingByClass(element, className) {
const	regClassName = getClassReg(className);

	while (element && (element = element.previousElementSibling)) {
		if (element.className && regClassName.test(element.className)) {
			break;
		}
	}

	return element;
}

function getNextSiblingByClass(element, className) {
const	regClassName = getClassReg(className);

	while (element && (element = element.nextElementSibling)) {
		if (element.className && regClassName.test(element.className)) {
			break;
		}
	}

	return element;
}

function getThisOrParentByClass(element, className) {
const	regClassName = getClassReg(className);

	while (element) {
		if (element.className && regClassName.test(element.className)) {
			break;
		}

		element = element.parentNode;
	}

	return element;
}

function getThisOrParentByTagName(element, tagName) {
	tagName = tagName.toLowerCase();

	while (element) {
		if (element.tagName && element.tagName.toLowerCase() === tagName) {
			break;
		}

		element = element.parentNode;
	}

	return element;
}

function getTargetParentByClass(element, className) {
	if (element && element.target) {
		element = element.target;
	}

	element = getThisOrParentByClass(element, className);

	if (element && element.tagName) {
		return element;
	}
}

function getTagAttrIfNotEmpty(name, values, delim) {
	if (name) {
		values = asArray(values).filter(arrayFilterNonEmptyValues);

		if (values.length > 0) {
			return (
				' '
			+		name
			+	'="'
			+		encodeTagAttr(values.join(delim || ' '))
			+	'"'
			);
		}
	}

	return '';
}

function getTableRowHTML(cells, tagName) {
	tagName = String(tagName || '') || 'td';

const	openTag = '<' + tagName + '>';
const	closeTag = '</' + tagName + '>';

	return (
		openTag
	+		getNestedJoinedText(cells, closeTag + openTag, '')
	+	closeTag
	);
}

function getTableHTML(...rows) {
	return (
		'<table><tr>'
	+	rows.map(
			(row) => (
				isNonNullObject(row) && (row.cells || row.cell_tag_name)
				? getTableRowHTML(row.cells, row.cell_tag_name)
				: getTableRowHTML(row)
			)
		).join('</tr><tr>')
	+	'</tr></table>'
	);
}

function getDropdownMenuHTML(headContent, listContent, headId, tagName) {
	if (isArray(arguments[0])) {
		[headContent, listContent, headId, tagName] = arguments[0];
	}

	tagName = String(tagName || '') || 'div';
	headContent = String(headContent);

const	openTag = '<' + tagName + ' class="';
const	closeTag = '</' + tagName + '>';

	return(
		openTag + 'menu-head"'
	+	getTagAttrIfNotEmpty('id', headId || '')
	+	' onmouseover="updateDropdownMenuPositions()">'
	+	(
			hasFraming(headContent, '<', '>')
			? headContent
			: (
				'<header class="button"'
			+	getTagAttrIfNotEmpty('title', getLocalizedOrEmptyText('hint_menu'))
			+	' onclick="toggleDropdownMenu(this)">'
			+		headContent
			+	'</header>'
			)
		)
	+	openTag + 'menu-drop">'
	+	openTag + 'menu-hid">'
	+	openTag + 'menu-list">'
	+		(listContent || '')
	+	closeTag
	+	closeTag
	+	closeTag
	+	closeTag
	);
}

function closeAllDropdownMenuTabs(element) {

const	tabBar = getThisOrParentByClass(element, regClassMenuBar);
const	tabs = getAllByClass('menu-head', tabBar);

	for (const tab of tabs) {
	const	header = getAllByTag('header', tab)[0];

		if (header && header !== element) {
			toggleClass(header, 'show', -1);
		}
	}

	START_WITH_OPEN_FIRST_MENU_TAB = false;
}

function toggleDropdownMenu(element) {
	closeAllDropdownMenuTabs(element);
	toggleClass(element, 'show');
}

function toggleSection(element, action) {

	function toggleSectionClass(header, element) {
	const	wasOpen = regClassShow.test(header.className);

		toggleClass(header,  'show',   isActionOpen ?  1 : isActionClose ? -1 : 0);
		toggleClass(element, 'hidden', isActionOpen ? -1 : isActionClose ?  1 : 0);

	const	justOpened = !wasOpen && regClassShow.test(header.className);

		if (
			isActionAll
			? justOpened
			: (isActionOpen || justOpened)
		) {
			toggleClass(element, 'open-up', 1);

			setTimeout(() => toggleClass(element, 'open-up', -1), 300);
		}
	}

	function toggleAllSections(element) {
	let	header;

		while (element) {
			if (header) {
				toggleSectionClass(header, element);

				++toggledCount;
			}

			header = (element.tagName === tagName ? element : null);
			element = element.nextElementSibling;
		}
	}

const	header = getThisOrParentByTagName(element, 'header');

	if (!header) {
		return;
	}

const	actionWords = (action || element.name || '').split('_');
const	isActionAll = actionWords.includes('all');
const	isActionOpen = actionWords.includes('open');
const	isActionClose = actionWords.includes('close');
const	tagName = header.tagName;

let	toggledCount = 0;

	if (isActionAll) {
		for (const section of getAllByTag('section', header.parentNode)) {
			toggleAllSections(getAllByTag('header', section)[0]);
		}

		if (!toggledCount) {
			toggleAllSections(header);
		}
	} else {
		toggleSectionClass(header, header.nextElementSibling);
	}

	updateDropdownMenuPositions();
}

function showHelpSection(sectionName, source) {
const	header = getOneById('top-menu-' + sectionName);

	if (header) {
		toggleSection(header, 'open');

		if (source) {
		const	sourceElement = (isString(source) ? getOneById('top-menu-' + source) : source);
		const	toSection = getThisOrParentByTagName(header, 'section');
		let	fromSection = getThisOrParentByTagName(sourceElement, 'section');
		let	alignWithTop = true;

			while (fromSection && toSection) {
				fromSection = fromSection.nextElementSibling;

				if (fromSection === toSection) {
					alignWithTop = false;

					break;
				}
			}

			toSection.scrollIntoView(alignWithTop);
		} else {
			header.scrollIntoView();
		}
	}
}

function toggleFixedTabWidth() {
const	isFixedTabWidthEnabled = toggleClass(document.body, 'fixed-tab-width');

	if (LS) {
		LS[LS_KEY_FIXED_TAB_WIDTH] = isFixedTabWidthEnabled;
	}
}

function toggleTextSize() {
const	isBigTextEnabled = toggleClass(document.body, 'larger-text');

	updateDropdownMenuPositions();

	if (LS) {
		LS[LS_KEY_BIG_TEXT] = isBigTextEnabled;
	}
}

function makeElementFitOnClick(element, initialState) {

//* Not listeners, because need attributes for style:

	element.className = initialState || 'size-fit';
	element.setAttribute('onclick', `toggleClass(this, 'size-fit'), toggleClass(this, 'size-full')`);
}

function getOffsetXY(element) {
let	x = 0;
let	y = 0;

	while (element) {
		x += element.offsetLeft;
		y += element.offsetTop;
		element = element.offsetParent;
	}

	return { x, y };
}

function putInView(element, x,y, changeOnlyX, changeOnlyY) {

const	viewport = window.visualViewport;
const	positionType = getStyleValue(element, 'position');
const	isPositionFixed = (positionType === 'fixed');

let	parentOffsetX = 0;
let	parentOffsetY = 0;

	if (positionType === 'absolute') {
	let	offset = getOffsetXY(element.offsetParent);
		parentOffsetX = offset.x;
		parentOffsetY = offset.y;
	}

	if (isRealNumber(x)) {
		x = orz(x) + parentOffsetX;
		y = orz(y) + parentOffsetY;
	} else {
	let	offset = getOffsetXY(element);
		x = offset.x;
		y = offset.y;
	}

	if (!changeOnlyY) {
	let	xMin = orz(isPositionFixed ? (document.body.scrollLeft || document.documentElement.scrollLeft) : 0);
	let	xMax = xMin + (viewport ? viewport.width : window.innerWidth) - element.offsetWidth;

		if (x > xMax) x = xMax;
		if (x < xMin) x = xMin;

		element.style.left = (x - parentOffsetX) + 'px';
	}

	if (!changeOnlyX) {
	let	yMin = orz(isPositionFixed ? (document.body.scrollTop || document.documentElement.scrollTop) : 0);
	let	yMax = yMin + (viewport ? viewport.height : window.innerHeight) - element.offsetHeight;

		if (y > yMax) y = yMax;
		if (y < yMin) y = yMin;

		element.style.top  = (y - parentOffsetY) + 'px';
	}

	return element;
}

function getNumbersArray(data, maxCount, splitBy, transformFunction) {
const	values = (
		isSlicableNotString(data)
		? Array.from(
			data
			.slice(0, orz(maxCount) || Infinity)
		)
		: (
			String(data)
			.split(splitBy || regNaN, orz(maxCount) || -1)
			.filter(isNotEmptyString)
		)
	);

	return (
		values
		.map(transformFunction || orz)
	);
}

function getUniqueNumbersArray() {
	return (
		getNumbersArray(...arguments)
		.filter(arrayFilterUniqueValues)
	);
}

function getFileBaseName(name) {
const	index = name.lastIndexOf('.');

	return (
		index > 0
		? name.substr(0, index)
		: name
	);
}

function getFileExt(name) { return name.split(/\./g).pop().toLowerCase(); }
function getFileName(path) { return path.split(/\//g).pop(); }
function getFilePathFromUrl(url) { return url.split(/\#/g).shift().split(/\?/g).shift(); }
function getFormattedFileNamePart(name) { return (name ? '[' + name + ']' : ''); }

function getFormattedFileSize(bytes, shortened) {
let	bytesText;

	if (bytes) {
	const	bytesNumber = orz(
			isNumber(bytes)
			? bytes
			: String(bytes).replace(regNaN, '')
		);

		bytesText = getLocalizedText(
			'file_bytes'
		,	bytesNumber.toLocaleString(LANG)	//* <- formatted for display
		,	bytesNumber				//* <- for text case selection, not displayed
		);
	}

	return (
		(shortened && bytesText)
		? (shortened + ' (' + bytesText + ')')
		: (shortened || bytesText || bytes)
	);
}

function leftPadNum(numValue, padToLength, paddingText) {
let	text = String(orz(numValue));
	padToLength = orz(padToLength) || 2;
	paddingText = String(paddingText || 0);

	while (text.length < padToLength) {
		text = paddingText + text;
	}

	return text;
}

function getFormattedTimezoneOffset(date) {
	if (!isDate(date)) {
		date = new Date();
	}

let	offset = date.getTimezoneOffset();

	if (offset) {
	let	sign = '-';

		if (offset < 0) {
			offset = -offset;
			sign = '+';
		}

	const	offsetHours = leftPadNum(Math.floor(offset / SPLIT_SEC));
	const	offsetMinutes = leftPadNum(offset % SPLIT_SEC);

		return sign + offsetHours + ':' + offsetMinutes;
	} else {
		return 'Z';
	}
}

function getFormattedHMS(msec) {
	msec = orz(msec);

const	sign = (msec < 0 ? '-' : '');
const	values = [0, 0, Math.floor(Math.abs(msec) / 1000)];

let	index = values.length;

	while (--index) {
		if (values[index] >= SPLIT_SEC) {
			values[index - 1] = Math.floor(values[index] / SPLIT_SEC);
			values[index] %= SPLIT_SEC;
		}

		if (values[index] < 10) {
			values[index] = '0' + values[index];
		}
	}

	return sign + values.join(':');
}

function getFormattedTime() {

	function getDatePartText(name) {
	let	num = date['get' + name]();

		if (name === 'Month') ++num;

		return leftPadNum(num);
	}

//* check arguments out of order:

const	flags = {};
let	arg, argDate, argNum, argText, date, YMD, HMS;

	for (const index in arguments) if (arg = arguments[index]) {
		if (isDate(arg)) argDate = arg; else
		if (isNumber(arg)) argNum = arg; else
		if (isString(arg)) argText = arg; else
		if (isNonNullObject(arg)) {
			for (const key in arg) {
				flags[key] = !!arg[key];
			}
		}

		if (TESTING > 9) console.log('getFormattedTime arg[' + index + ']:', [typeof arg, arg]);
	}

	if (!date && argText && isFunction(Date.parse)) {
		date = Date.parse(argText.replace(regHMS, '$1:$2:$3'));
	}
	if (!date && argText) date = orz(argText);
	if (!date && argDate) date = argDate;
	if (!date && argNum) date = argNum;
	if (!date) {
		date = new Date();
	} else
	if (!isDate(date)) {
		if (date < 0) date += getTimeNow();

		date = new Date(date);
	}

//* get date text parts:

const	textParts = [];

	if (
		flags.onlyYMD
	||	!flags.onlyHMS
	) {
		YMD = (
			TIME_PARTS_YMD
			.map(getDatePartText)
			.join('-')
		);

		textParts.push(YMD);
	}

	if (
		flags.onlyHMS
	||	!flags.onlyYMD
	) {
		HMS = (
			TIME_PARTS_HMS
			.map(getDatePartText)
			.join(flags.fileNameFormat ? '-' : ':')
		);

		if (flags.logFormat) {
		const	msec = (
				isFunction(date.getMilliseconds)
				? date.getMilliseconds()
				: (date % 1000)
			);

			HMS += '.' + leftPadNum(msec, 0,3);
		}

		textParts.push(HMS);
	}

//* get date text:

	if (
		flags.logFormat
	||	flags.fileNameFormat
	||	flags.plainTextFormat
	||	flags.onlyYMD
	||	flags.onlyHMS
	) {
		return (
			textParts
			.join(flags.fileNameFormat ? '_' : ' ')
		);
	} else {

//* get date HTML:

		return (
			'<time datetime="'
		+		YMD + 'T'
		+		HMS + getFormattedTimezoneOffset(date)
		+	'" data-t="' + (
				isFunction(date.getTime)
				? date.getTime()
				: Math.floor(date / 1000)
			)
		+	'">'
		+		YMD
		+		' <small>'
		+			HMS
		+		'</small>'
		+	'</time>'
		);
	}
}

function getTimeNow() { return +new Date(); }
function getLogTime() { return getFormattedTime(FLAG_TIME_LOG_FORMAT); }

function logTime() {
let	logText = getLogTime();
let	arg;

	for (const index in arguments) if (typeof (arg = arguments[index]) !== 'undefined') {
	const	textValue = getJoinedOrEmptyText(arg, '\n');

		if (textValue.includes('\n')) {
			if (
				hasFraming(textValue, '(', ')')
			||	hasFraming(textValue, '{', '}')
			||	hasFraming(textValue, '[', ']')
			) {
				logText += ':\n' + textValue;
			} else {
				logText += ':\n[\n' + textValue + '\n]';
			}
		} else
		if (index > 0) {
			logText += ' = "' + textValue + '"';
		} else {
			logText += ' - ' + textValue;
		}
	}

	console.log(logText);
}

function logError(error, args, context) {
	console.error(
		'Error:'
	,	[
			error,
		].concat(
			typeof args === 'undefined' ? DUMMY_EMPTY_ARRAY : [
				// 'In function:', args.callee.name,	//* <- not available in strict mode
				'With arguments:', args,
			]
		).concat(
			typeof context === 'undefined' ? DUMMY_EMPTY_ARRAY : [
				'Context:', context
			]
		)
	);
}

function callbackOnImgLoad(img, resolve, reject) {
	if (isImageElement(img)) {
		if (img.complete) {
			resolve(img);
		} else {
			img.onerror = reject;
			img.onload = () => resolve(img);
		}
	} else {
		reject(img);
	}
}

async function resolvePromiseOnImgLoad(img, resolve, reject) {
	img = await img;

	if (isPromise(img)) {
		img
		.then((img) => callbackOnImgLoad(img, resolve, reject))
		.catch(reject);
	} else {
		callbackOnImgLoad(img, resolve, reject);
	}
}

function getFilePromise(file, context) {

//* Note: "file" may be a blob object.
//* Source: https://stackoverflow.com/a/15981017

	if (
		!file
	||	typeof FileReader !== 'function'
	) {
		return null;
	}

	return new Promise(
		(resolve, reject) => {
		const	reader = new FileReader();

			if (context) {
				reader.onloadstart =
				reader.onloadend =
				reader.onprogress = (evt) => updateProjectOperationProgress(
					context
				,	'project_status_loading_file'
				,	evt.loaded || evt.position || '?'
				,	getLocalizedOrDefaultText('file_bytes', evt.total || evt.totalSize || '?')
				);
			}

			reader.onabort =
			reader.onerror = (evt) => getErrorFromEvent(evt, 'FileReader failed.', reject);

			reader.onload = (evt) => {
			const	result = evt.target.result;

				if (result) {
					resolve(result);
				} else {
					getErrorFromEvent(evt, 'FileReader completed, got empty or no result.', reject);
				}
			};

			reader.readAsArrayBuffer(file);
		}
	).catch(catchPromiseError);
}

function getFilePromiseFromURL(url, responseType, context) {

//* Note: "url" may be a "blob:" or "data:" url.
//* Source: https://www.mwguy.com/decoding-a-png-image-in-javascript/

	if (
		!url
	||	typeof XMLHttpRequest !== 'function'
	) {
		return null;
	}

	return new Promise(
		(resolve, reject) => {
		const	request = new XMLHttpRequest();

			if (context) {
				request.onloadstart =
				request.onloadend =
				request.onprogress = (evt) => updateProjectOperationProgress(
					context
				,	'project_status_loading_file'
				,	evt.loaded || evt.position || '?'
				,	getLocalizedOrDefaultText('file_bytes', evt.total || evt.totalSize || '?')
				);
			}

			request.ontimeout =
			request.onabort =
			request.onerror = (evt) => getErrorFromEvent(evt, 'Request failed.', reject);

			request.onload = (evt) => {
			const	response = evt.target.response;

				if (response) {
					if (isFunction(request.getAllResponseHeaders)) {
						response.headers = request.getAllResponseHeaders();
					}

					if (isFunction(request.getResponseHeader)) {
					const	lastModText = request.getResponseHeader('Last-Modified');

						if (lastModText) {
							response.lastModified = +new Date(lastModText);
						}
					}

					resolve(response);
				} else {
					getErrorFromEvent(evt, 'Request completed, got empty or no response.', reject);
				}
			};

			request.responseType = responseType || 'arraybuffer';
			request.open('GET', url, true);
			request.send();
		}
	).catch(catchPromiseError);
}

function getImagePromiseFromCanvasToBlob(canvas, trackList, mimeType, quality, img) {

	function getImagePromiseFromBlob(blob) {
		if (!blob) {
			throw 'Canvas to blob: got empty or no blob.';
		}

	const	url = URL.createObjectURL(blob);

		trackList = addURLToTrackList(url, trackList);

		if (!img) {
			img = cre('img');
		}

		return new Promise(
			(resolve, reject) => {
				img.onload = (evt) => {
					// URL.revokeObjectURL(url);	//* <- let the outside code clean up after it's done

					if (canvas.top)  img.top  = canvas.top;
					if (canvas.left) img.left = canvas.left;

					resolve(img);
				};

				img.onerror = (evt) => {
					if (!trackList) {
						URL.revokeObjectURL(url);
					}

					if (TESTING) console.error('Image loading failed:', [url, img, evt]);

					getErrorFromEvent(evt, 'Canvas to blob: image loading failed.', reject);
				};

				img.type = blob.type.split('/').pop();
				img.src = url;
			}
		);
	}

	return (
		new Promise(
			(resolve, reject) => canvas.toBlob(resolve, mimeType || '', quality || 1)
		)
		.then(getImagePromiseFromBlob)
		.catch(catchPromiseError)
	);
}

//* Note: cannot save image by revoked url, so better keep it and revoke later.
function addURLToTrackList(url, trackList) {
	if (isNonNullObject(trackList)) {
		if (!isFunction(trackList.push)) {
			trackList = getOrInitChild(trackList, 'blobs', Array);
		}

		addToListIfNotYet(trackList, url);

		return trackList;
	} else {
		return null;
	}
}

function revokeBlobsFromTrackList(trackList) {
let	count = 0;

	if (isNonNullObject(trackList)) {

		if (isFunction(trackList.push)) {
			for (const blob of trackList) if (blob) {
				URL.revokeObjectURL(blob.url || blob);

				++count;
			}
		} else
		if (isNonNullObject(trackList = trackList.blobs)) {

			if (isFunction(trackList.push)) {
				count += revokeBlobsFromTrackList(trackList);
			} else
			for (const listName in trackList) {
				count += revokeBlobsFromTrackList(trackList[listName]);
			}
		}
	}

	return count;
}

function getImageDataFromData(imageData) {
	if (isImageData(imageData)) {
		return imageData;
	}

	if (isNonNullImageData(imageData)) {
	const	{ data, width, height } = imageData;

		imageData = new ImageData(width, height);
		arrayFillRepeat(imageData.data, data);

		return imageData;
	}
}

async function getImageElementFromData(imageData, project, colorsCount) {
	if (imageData = getImageDataFromData(imageData)) {
		if (
			USE_UPNG
		&&	await loadLibOnDemandPromise('UPNG.js')
		) {
		const	arrayBuffer = UPNG.encode(
				[imageData.data.buffer]	//* <- array of frames. A frame is an ArrayBuffer (RGBA, 8 bits per channel).
			,	imageData.width
			,	imageData.height
			,	orz(colorsCount)	//* <- does not make color-fill PNGs smaller
			);

		const	url = getBlobURLFromByteArray(arrayBuffer, 'image/png');
		const	img = cre('img', (TESTING_PNG ? document.body : null));
			img.src = url;

			if (TESTING_PNG) console.log('getImageElementFromData:', [imageData, arrayBuffer, url, img]);

			return new Promise(
				(resolve, reject) => resolvePromiseOnImgLoad(img, resolve, reject)
			).catch(catchPromiseError);
		}

	let	canvas, img;

		if (
			isCanvasElement(canvas = getCanvasFromImageData(imageData))
		&&	isImageElement(img = await getImagePromiseFromCanvasToBlob(canvas, project))
		) {
			return img;
		}
	}
}

//* Not used yet: *------------------------------------------------------------

function getImageDataFromArrayBuffer(arrayBuffer) {
const	img = UPNG.decode(arrayBuffer);
const	rgbaArray = UPNG.toRGBA8(img)[0];	//* <- UPNG.toRGBA8 returns array of frames, size = width * height * 4 bytes.
const	imageData = new ImageData(img.width, img.height);
	imageData.data.set(rgbaArray);

	return imageData;
}

function getImageDataPromiseFromBlob(blob) {
	return (
		blob
		.arrayBuffer()
		.then((arrayBuffer) => getImageDataFromArrayBuffer(arrayBuffer))
		.catch(catchPromiseError)
	);
}

async function getImageDataFromURL(url) {
	if (
		isString(url)
	&&	url.length > 0
	) {
	const	arrayBuffer = await getFilePromiseFromURL(url, 'arraybuffer').catch(catchPromiseError);

		if (arrayBuffer) {
			return getImageDataFromArrayBuffer(arrayBuffer);
		}
	}
}

//* legacy copypasted code to get things working, don't bother with readability, redo later:

function getBlobURLFromByteArray(data, type) {
	if (isArray(data)) {
		data = Uint8Array.from(data, (v) => v.charCodeAt(0)).buffer;
	}

	return URL.createObjectURL(new Blob( [data], { type } ));
}

function dataToBlob(data, trackList) {
	if (URL && URL.createObjectURL) {
	let	type = TYPE_TEXT;

		if (hasPrefix(data, DATA_PREFIX)) {
		const	i = data.indexOf(',');
		const	meta = data.slice(0,i);
		const	k = meta.indexOf(';');

			data = data.slice(i+1);

			if (k < 0) {
				type = meta;
				data = decodeURIComponent(data);
			} else {
				type = meta.slice(0,k);
				if (meta.slice(k+1) === 'base64') data = atob(data);
			}
		}

	const	size = data.length;
	const	url = getBlobURLFromByteArray(data, type);

		if (url) {
			addURLToTrackList(url, trackList);

			return { size, type, url };
		}
	}
}

function saveDL(data, fileName, ext, addTime, jsonReplacerFunc) {

	function cleanUpAfterDL() {
		if (a) del(a);
		if (revokeURL) URL.revokeObjectURL(url);
	}

	if (TESTING > 1) console.log(fileName, ext, data);

let	blob, size, type, url;
let	revokeURL = false;

	if (isBlob(data)) {
		blob = data;
		size = blob.size;
		type = blob.type;
		url = URL.createObjectURL(blob);
		revokeURL = true;
	} else {
		type = TYPE_TEXT;
		data = (
			isNonNullObject(data)
			? JSON.stringify(
				data
			,	jsonReplacerFunc || null
			,	'\t'
			)
			: String(data)
		);

		if (hasPrefix(data, BLOB_PREFIX)) {
			url = data;
			blob = true;
			size = data.length;
		} else {
			if (hasPrefix(data, DATA_PREFIX)) {
				url = data;
			} else {
				url = DATA_PREFIX + type + ',' + encodeURIComponent(data);
			}

			if (blob = dataToBlob(data)) {
				size = blob.size;
				type = blob.type;
				url = blob.url;
				revokeURL = true;
			} else {
				size = url.length;
				type = url.split(';', 1)[0].split(':', 2)[1];
			}

			if (!ext) {
				ext = type.split('/').slice(-1)[0];
			}
		}
	}

	if (ext === 'plain') ext = 'txt';

const	time = (
		!fileName || addTime
		? getFormattedTime(FLAG_TIME_FILENAME_FORMAT)
		: ''
	);

const	baseName = (
		!fileName ? time
		: (addTime > 0) ? fileName + '_' + time
		: (addTime < 0) ? time + '_' + fileName
		: fileName
	);

	fileName = baseName;

	if (ext && !hasPostfix(fileName, ext = '.' + ext)) {
		fileName += ext;
	}

	logTime(
		'saving "' + fileName + '", '
		+ (
			blob
			? 'data size = ' + size + ' bytes, blob URI = ' + url
			: 'data URI size = ' + size + ' bytes'
		)
	);

const	a = cre('a', document.body);

	if (a && 'download' in a) {
		a.download = fileName;
		a.href = url;
		a.click();
	} else {
		window.open(url, '_blank');

		logTime('opened file to save');
	}

	if (a) setTimeout(cleanUpAfterDL, Math.max(Math.ceil(size / 1000), 12345));

	return size;
}

function loadLibPromise(...libs) {
let	dir, scripts;

	libs = getFlatArray(libs);

	return new Promise(
		(resolve, reject) => {
			function addNextScript() {
				if (
					scripts
				&&	scripts.length > 0
				) {
				const	src = scripts.shift();

					if (isString(src)) {
					const	script = cre('script', document.head);
						script.onload = addNextScript;
						script.onerror = (evt) => getErrorFromEvent(evt, 'Script loading failed.', reject);
						script.src = dir + src;
					} else {
						addNextScript();
					}
				} else if (
					libs
				&&	libs.length > 0
				) {
				const	lib = libs.shift();

					dir = lib.dir || '';
					scripts = asFlatArray(lib.files || lib);

					addNextScript();
				} else {
					resolve(true);
				}
			}

			addNextScript();
		}
	).catch(catchPromiseError);
}

async function loadAllLibsOnDemand(...libs) {

	for (const libName of getFlatArray(libs))
	if (! await loadLibOnDemandPromise(libName)) {
		return false;
	}

	return true;
}

async function loadLibOnDemandPromise(libName) {
	if (!libName) {
		return true;
	}

const	lib = FILE_TYPE_LIBS[libName] || null;

	if (!lib) {
		return false;
	}

const	varName = lib.varName || '';

	if (varName && window[varName]) {
		return true;
	}

const	dir = lib.dir || '';
const	scripts = asFlatArray(lib.files);
const	depends = asFlatArray(lib.depends);

	if (
		!scripts.length
	||	! await loadAllLibsOnDemand(...depends)
	) {
		return false;
	}

	return new Promise(
		(resolve, reject) => {

			function addNextScript(evt) {

//* some var init, no better place for this:

				if (varName && window[varName]) {
					if (varName === 'zip') {
						if (zip.useWebWorkers = USE_WORKERS_IF_CAN) {

//* Notes:
//*	Either zip.workerScripts or zip.workerScriptsPath may be set, not both.
//*	Scripts in the array are executed in order, and the first one should be z-worker.js, which is used to start the worker.
//* Source: http://gildas-lormeau.github.io/zip.js/core-api.html#alternative-codecs

							if (ZIP_WORKER_SCRIPTS) {
								zip.workerScripts = {
									'deflater' : ZIP_WORKER_SCRIPTS,
									'inflater' : ZIP_WORKER_SCRIPTS,
								};
							} else {
								zip.workerScriptsPath = dir;
							}
						}
					}

					if (varName === 'ora') {
						ora.preloadImages = false;
						ora.zipCompressImageFiles = true;
						ora.enableWorkers = USE_WORKERS_IF_CAN;
						ora.scriptsPath = dir;
					}
				}

				if (
					varName === 'PSD_JS'
				&&	!window[varName]
				&&	evt
				&&	typeof require !== 'undefined'
				) {
					window[varName] = require('psd');
				}

//* add scripts one by one, skip empty values:

			let	scriptSrc;

				while (scripts.length > 0)
				if (scriptSrc = scripts.shift()) {
					break;
				}

				if (scriptSrc) {
				const	script = cre('script', document.head);
					script.setAttribute('data-lib-name', libName);
					script.onload = addNextScript;
					script.onerror = (evt) => getErrorFromEvent(evt, 'Script loading failed.', reject);
					script.src = dir + scriptSrc;
				} else

//* then check whether the required object is present:

				if (!varName || window[varName]) {
					logTime('"' + libName + '" library finished loading');

					resolve(true);
				} else {

//* otherwise, cleanup and report fail:

					del(
						getAllByTag('script', document.head)
						.filter(
							(script) => (script.getAttribute('data-lib-name') === libName)
						)
					);

					logTime('"' + libName + '" library failed loading');

					resolve(false);
				}
			}

			addNextScript();
		}
	).catch(catchPromiseError);
}

//* Page-specific functions: internal, utility *-------------------------------

function getProjectContainer(element) { return getTargetParentByClass(element, regClassLoadedFile); }
function getProjectButton(element) { return getTargetParentByClass(element, regClassButton); }

function replaceJSONpartsForCropRef(key, value) {
	if (key === 'autocrop') {
		return;
	}

	return value;
}

function replaceJSONpartsForZoomRef(key, value) {
	if (key === 'autocrop') {
		return;
	}

	if (key === 'zoom') {

//* remove invalid values, reassure the percent sign:

		if (isString(value)) {
		const	targetRefZoom = orz(value);

			if (targetRefZoom <= 0 || targetRefZoom === 100) {
				return;
			}

//* zoom in steps, downscale by no more than x2, starting from 100 to nearest-sized reference:

		let	nearestRefZoom = 100;

			while (
				nearestRefZoom > 0
			&&	nearestRefZoom > targetRefZoom
			) {
			const	nextStepZoom = Math.floor(nearestRefZoom / ZOOM_STEP_MAX_FACTOR);

				if (targetRefZoom >= nextStepZoom) {
					break;
				}

				nearestRefZoom = nextStepZoom;
			}

			if (nearestRefZoom <= 0 || nearestRefZoom === 100) {
				return;
			}

			return String(nearestRefZoom) + '%';
		} else

//* keep as is the same-key object parent, throw away anything else:

		if (!isNonNullObject(value)) {
			return;
		}
	}

	return value;
}

function clearCanvasBeforeGC(canvas) {
	if (
		canvas
	&&	isCanvasElement(canvas = canvas.canvas || canvas)
	) {
		canvas.width = 1;
		canvas.height = 1;

		return canvas;
	}
}

function getImageSrcPlaceholder() {
	if (!thumbnailPlaceholder) {
	const	canvas = cre('canvas');
	const	ctx = canvas.getContext('2d');
	const	imageSize = TAB_THUMBNAIL_SIZE || THUMBNAIL_SIZE;
	const	w = canvas.width  = imageSize;
	const	h = canvas.height = imageSize;
	const	textHeight = imageSize - 2;

		ctx.fillStyle = 'lightgray';
		ctx.fillRect(0,0, w,h);

		ctx.lineWidth = 1;
		ctx.strokeStyle = 'gray';
		ctx.strokeRect(0,0, w,h);

		ctx.fillStyle = 'gray';
		ctx.strokeStyle = 'gray';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.font = 'bold ' + textHeight + 'px sans-serif';

	const	text = '?';
	const	textWidth = ctx.measureText(text).width;
	const	x = Math.round((w - textWidth) / 2);
	const	y = Math.round((h - textHeight) / 2);

		ctx.fillText(text, x,y);

		thumbnailPlaceholder = canvas.toDataURL();
	}

	return thumbnailPlaceholder;
}

function setImageSrc(img, data, onLoad, onError) {
	if (isImageElement(img)) {
		if (data || !img.src) {
			img.src = data || getImageSrcPlaceholder();

			if (onLoad || onError) {
				return new Promise(
					(resolve, reject) => resolvePromiseOnImgLoad(
						img
					,	(onLoad  ? ((img)   => { resolve(img),  onLoad(img)    }) : resolve)
					,	(onError ? ((error) => { reject(error), onError(error) }) : reject)
					)
				).catch(catchPromiseError);
			}
		}
	} else
	if (
		isNonNullObject(img)
	&&	img.style
	) {
		if (data || !img.style.backgroundImage) {
			data = data || getImageSrcPlaceholder();
			img.style.backgroundImage = 'url("' + data + '")';
		}
	}

	return img;
}

function getImageContentSize(img) {
const	width  = img.naturalWidth  || img.width;
const	height = img.naturalHeight || img.height;

	return { width, height };
}

function getResizedCanvasFromImg(img, w,h) {
const	canvas = cre('canvas');
const	ctx = canvas.getContext('2d');
const	size = getImageContentSize(img);
const	widthFrom  = size.width;
const	heightFrom = size.height;

let	widthTo  = w || widthFrom || 1;
let	heightTo = h || w || heightFrom || 1;

const	widthRatio  = widthFrom/widthTo;
const	heightRatio = heightFrom/heightTo;
const	zoomFactor = TAB_ZOOM_STEP_MAX_FACTOR || ZOOM_STEP_MAX_FACTOR;

	if (
		widthRatio  > zoomFactor
	||	heightRatio > zoomFactor
	) {

//* caclulate nearest scale factor top down:

		if (DOWNSCALE_BY_MAX_FACTOR_FIRST) {
			canvas.width  = widthTo  = Math.round(widthFrom  / zoomFactor);
			canvas.height = heightTo = Math.round(heightFrom / zoomFactor);
		} else {

//* caclulate nearest scale factor bottom up - more complex, but result is not better:

			if (widthRatio < heightRatio) {
				widthTo = Math.round(widthFrom / heightRatio);
			} else
			if (widthRatio > heightRatio) {
				heightTo = Math.round(heightFrom / widthRatio);
			}

		let	widthToUp  = widthTo;
		let	heightToUp = heightTo;

			while (
				widthTo  < widthFrom
			&&	heightTo < heightFrom
			) {
				widthToUp  *= zoomFactor;
				heightToUp *= zoomFactor;

				if (
					widthToUp  < widthFrom
				&&	heightToUp < heightFrom
				) {
					widthTo  = widthToUp;
					heightTo = heightToUp;
				} else {
					break;
				}
			}

			canvas.width  = widthTo;
			canvas.height = heightTo;
		}

		ctx.drawImage(img, 0,0, widthFrom, heightFrom, 0,0, widthTo, heightTo);

		return getResizedCanvasFromImg(canvas, w,h);
	} else {
	let	xOffset = 0;
	let	yOffset = 0;

		canvas.width = widthTo;
		canvas.height = heightTo;

		if (widthRatio < heightRatio) {
			widthTo = Math.round(widthFrom / heightRatio);
			xOffset = Math.round((canvas.width - widthTo) / 2);
		} else
		if (widthRatio > heightRatio) {
			heightTo = Math.round(heightFrom / widthRatio);
			yOffset = Math.round((canvas.height - heightTo) / 2);
		}

		ctx.drawImage(img, 0,0, widthFrom, heightFrom, xOffset, yOffset, widthTo, heightTo);

		return canvas;
	}
}

function getCanvasFromImageData(imageData) {
	if (imageData = getImageDataFromData(imageData)) {
	const	canvas = cre('canvas');
	const	ctx = canvas.getContext('2d');
	const	{ data, width, height } = imageData;

		canvas.width = width;
		canvas.height = height;

		ctx.putImageData(imageData, 0,0);

		return canvas;
	}

	if (TESTING > 2) console.error('getCanvasFromImageData failed:', arguments);
}

function getCtxFromImageData(imageData) {
const	canvas = cre('canvas');
const	ctx = canvas.getContext('2d');

	canvas.width = imageData.width;
	canvas.height = imageData.height;

	ctx.putImageData(imageData, 0,0);

	return ctx;
}

function getImageDataInverted(imageData) {
const	ctx = getCtxFromImageData(imageData);
const	w = imageData.width;
const	h = imageData.height;

	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = BLEND_MODE_INVERT;
	ctx.fillStyle = 'white';
	ctx.fillRect(0,0, w,h);

	return ctx.getImageData(0,0, w,h);
}

function getImageData(img, x,y, w,h) {
	if (!isNonNullObject(img)) {
		return;
	}

const	size = getImageContentSize(img);

	if (isCanvasElement(img)) {
	const	canvas = img;
	const	ctx = canvas.getContext('2d');

		x = orz(x);
		y = orz(y);
		w = orz(w) || (size.width  - x);
		h = orz(h) || (size.height - y);

		return ctx.getImageData(x,y, w,h);
	}

	if (isImageElement(img)) {
	const	canvas = cre('canvas');
	const	ctx = canvas.getContext('2d');

		canvas.width  = w = orz(w || size.width)  - orz(x);
		canvas.height = h = orz(h || size.height) - orz(y);
		x = 0;
		y = 0;

		ctx.drawImage(img, x,y);

		return ctx.getImageData(x,y, w,h);
	}
}

function getFirstPixelRGBA(img) {
	if (isImageElement(img)) {
		img = getImageData(img, 0,0, 1,1).data;
	}

	if (img && img.slice) {
		return img.slice(0,4);
	}
}

function getAutoCropArea(img, bgToCheck) {
const	imageData = getImageData(img);

	if (!isNonNullImageData(imageData)) {
		return;
	}

const	w = imageData.width;
const	h = imageData.height;
const	data = imageData.data;
const	totalBytes = data.length;
const	horizontalBytes = w << 2;

let	bgRGBA;
let	bgPixelIndex = -1;
let	foundBottom = -1;
let	foundRight = -1;
let	foundLeft = -1;
let	foundTop = -1;

	if (
		bgToCheck
	&&	bgToCheck.length
	&&	bgToCheck !== 'transparent'
	) {
		if (bgToCheck === 'topleft') bgPixelIndex = 0; else
		if (bgToCheck === 'topright') bgPixelIndex = w - 1; else
		if (bgToCheck === 'bottomleft') bgPixelIndex = w*(h - 1); else
		if (bgToCheck === 'bottomright') bgPixelIndex = (w*h) - 1;

		if (bgPixelIndex >= 0) {
		const	bgByteIndex = bgPixelIndex << 2;

			bgRGBA = data.slice(bgByteIndex, bgByteIndex + 4);
		} else {
			if (bgToCheck.match) {
				bgToCheck = getRGBAFromColorCodeOrName(bgToCheck);
			}

			if (bgToCheck.concat) {
				bgRGBA = getRGBACutOrPadded(bgToCheck, DEFAULT_COLOR_VALUE_ARRAY);
			}
		}
	}

	bgRGBA = (
		bgRGBA
		? Array.from(bgRGBA)
		: TRANSPARENT_COLOR_VALUE_ARRAY
	);

//* find fully transparent areas:

	if (bgRGBA[3] === 0) {

		find_top:
		for (let index = 3; index < totalBytes; index += 4) {
			if (data[index]) {
				foundTop = Math.floor(index / horizontalBytes);

				break find_top;
			}
		}

	//* found no content:

		if (foundTop < 0) {
			return;
		}

	//* found something:

		find_bottom:
		for (let index = totalBytes - 1; index >= 0; index -= 4) {
			if (data[index]) {
				foundBottom = Math.floor(index / horizontalBytes);

				break find_bottom;
			}
		}

	//* reduce field of search:

	const	foundTopIndex = (foundTop * horizontalBytes) + 3;
	const	foundBottomIndex = (foundBottom * horizontalBytes) + 3;

		find_left:
		for (let x = 0; x < w; ++x)
		for (let index = (x << 2) + foundTopIndex; index <= foundBottomIndex; index += horizontalBytes) {
			if (data[index]) {
				foundLeft = x;

				break find_left;
			}
		}

		find_right:
		for (let x = w-1; x >= 0; --x)
		for (let index = (x << 2) + foundTopIndex; index <= foundBottomIndex; index += horizontalBytes) {
			if (data[index]) {
				foundRight = x;

				break find_right;
			}
		}
	} else {

//* find same RGBA filled areas:

	let	index = totalBytes;

		find_bottom:
		while (index--) {
			if (data[index] !== bgRGBA[index & 3]) {
				foundBottom = Math.floor(index / horizontalBytes);

				break find_bottom;
			}
		}

	//* found no content:

		if (foundBottom < 0) {
			return;
		}

	//* found something:

		find_top:
		for (let index = 0; index < totalBytes; ++index) {
			if (data[index] !== bgRGBA[index & 3]) {
				foundTop = Math.floor(index / horizontalBytes);

				break find_top;
			}
		}

	//* reduce field of search:

	const	foundTopIndex = (foundTop * horizontalBytes);
	const	foundBottomIndex = (foundBottom * horizontalBytes);

		find_left:
		for (let x = 0; x < w; ++x)
		for (let index = (x << 2) + foundTopIndex; index <= foundBottomIndex; index += horizontalBytes) {
			if (
				data[index  ] !== bgRGBA[0]
			||	data[index|1] !== bgRGBA[1]
			||	data[index|2] !== bgRGBA[2]
			||	data[index|3] !== bgRGBA[3]
			) {
				foundLeft = x;

				break find_left;
			}
		}

		find_right:
		for (let x = w-1; x >= 0; --x)
		for (let index = (x << 2) + foundTopIndex; index <= foundBottomIndex; index += horizontalBytes) {
			if (
				data[index  ] !== bgRGBA[0]
			||	data[index|1] !== bgRGBA[1]
			||	data[index|2] !== bgRGBA[2]
			||	data[index|3] !== bgRGBA[3]
			) {
				foundRight = x;

				break find_right;
			}
		}
	}

const	foundWidth = foundRight - foundLeft + 1;
const	foundHeight = foundBottom - foundTop + 1;

	return {
		'left'   : foundLeft
	,	'right'  : foundRight

	,	'top'    : foundTop
	,	'bottom' : foundBottom

	,	'width'  : foundWidth
	,	'height' : foundHeight
	};
}

function addButton(parent, text, func) {
const	button = cre('button', parent);
	button.textContent = text || button.tagName;

	if (func) {
		button.setAttribute('onclick', func);
	}

	return button;
}

function addNamedButton(container, name, label) {
const	button = addButton(container, getLocalizedText(label || name));
	button.name = name || label;

	return button;
}

function addButtonGroup(container, group) {

const	buttonsBox = cre('div', container);
	buttonsBox.className = 'panel';

	for (const buttonName in group) {
	const	entry = group[buttonName];

		if (isString(entry)) {
			addNamedButton(buttonsBox, buttonName, entry);
		} else
		if (isNonNullObject(entry)) {
		const	nestedBox = addButtonGroup(buttonsBox, entry);

			if (!regClassRow.test(buttonsBox.className)) {
				toggleClass(nestedBox, 'row', 1);
			}
		}
	}

	return container;
}

function addOption(parent, text, value) {
const	option = cre('option', parent);

	text = getJoinedOrEmptyText(text);
	value = getJoinedOrEmptyText(value) || text;

	option.value = value;
	option.textContent = text;

	return option;
}

function trimParam(text) {
	return (
		String(text)
		.replace(regTrimParam, '')
	);
}

function getOtherSwitchParamName(switchType, switchName) {
const	names = SWITCH_NAMES_BY_TYPE[switchType];
const	index = names.indexOf(switchName);

	return names[index === 0 ? 1 : 0];
}

function getTruthyValue(value) {
	return !(
		!value
	||	!(value = String(value))
	||	FALSY_STRINGS.includes(value.toLowerCase())
	);
}

function getNormalizedOpacity(numValue) {
	return Math.max(0, Math.min(1, orz(numValue) / MAX_OPACITY));
}

function getNormalizedBlendMode(text, remaps, replacements) {
	remaps = remaps || BLEND_MODES_REMAP;
	replacements = replacements || BLEND_MODES_REPLACE;

const	blendMode = String(text).toLowerCase();
let	replaced;

	return (
		remaps[blendMode]
	||	remaps[
			replaced = trim(
				replacements.reduce(
					(text, fromTo) => text.replace(fromTo[0], fromTo[1] || '')
				,	blendMode
				)
			)
		]
	||	replaced
	||	blendMode
	);
}

function getParentLayer(layer, propName, isTrue) {
	if (!layer) {
		return null;
	}

	while (layer = layer.parent) {
		if (
			layer.params
		&&	(
				!propName
			||	(!layer[propName] === !isTrue)
			)
		) {
			break;
		}
	}

	return layer;
}

function getLayerVisibilityParent(layer) {
	if (layer.copyPastedTo) {
		return null;
	}

	return layer.clippingLayer || getParentLayer(layer);
}

function getLayerChain(layer, getNextLayerCallback) {
const	layers = [];

	while (layer) {
		layers.push(layer);

		layer = getNextLayerCallback(layer);
	}

	return layers.reverse();
}

function getLayerNestingChain(layer) { return getLayerChain(layer, getParentLayer); }
function getLayerVisibilityChain(layer) { return getLayerChain(layer, getLayerVisibilityParent); }

function getLayerPathNamesChain(layer, flags) {
	if (!layer) {
		return DUMMY_EMPTY_ARRAY;
	}

	if (!isNonNullObject(flags)) {
		flags = {};
	}

const	path = (flags.includeSelf ? [layer.name] : []);

	while (layer = getParentLayer(layer)) {
		path.unshift(layer.name);
	}

	if (flags.asText) {
		return path.join(flags.separator || ' / ');
	}

	return path;
}

function getLayerPathText(layer) {
	return getLayerPathNamesChain(layer, FLAG_LAYER_PATH_TEXT);
}

function getLayersTopSeparated(layers) {
let	layersToRender = DUMMY_EMPTY_ARRAY;

	while (isNonEmptyArray(layers)) {
		layersToRender = layers.filter(isLayerRendered);

		if (layersToRender.length > 1) {
			return layersToRender;
		} else
		if (layersToRender.length > 0) {
			layers = layersToRender[0].layers;
		} else {
			break;
		}
	}

	return layersToRender;
}

function isLayerRendered(layer) {
	if (TESTING && !(isNonNullObject(layer) && layer.params)) {
		console.error('No params, maybe not a layer:', [layer, getLayerPathText(layer)]);
	}

	return !(
		layer.params.skip
	||	layer.params.skip_render
	||	(layer.clippingLayer && !isLayerRendered(layer.clippingLayer))
	);
}

function isLayerSkipped(layer) {
	if (TESTING && !(isNonNullObject(layer) && layer.params)) {
		console.error('No params, maybe not a layer:', [layer, getLayerPathText(layer)]);
	}

	return !!(
		layer.params.skip
	||	(regLayerNameToSkip && regLayerNameToSkip.test(layer.name))
	||	(layer.clippingLayer && isLayerSkipped(layer.clippingLayer))
	);
}

function hasImageToLoad(layer) {
	return (
		layer.params.color_code
	||	IMAGE_DATA_KEYS_TO_LOAD.some((key) => (key in layer))
	||	(
			layer.mask
		&&	IMAGE_DATA_KEYS_TO_LOAD.some((key) => (key in layer.mask))
		)
	||	(
			!layer.layers
		&&	layer.width > 0
		&&	layer.height > 0
		)
	);
}

//* pile of hacks and glue to get things working:

async function getOrLoadImage(project, layer) {

	async function thisToPngTryOne(target, node) {

		function getResultPromiseIfMethodExists(methodName) {
			return (
				isNonRecursiveFunction(node[methodName])
				? new Promise(
					(resolve, reject) => (
						hasPrefix(methodName, 'to')
						? resolvePromiseOnImgLoad(node[methodName](), resolve, reject)
						: node[methodName](resolve, reject)
					)
				).catch(catchPromiseError)
				: null
			);
		}

		function isNonRecursiveFunction(func) {
			return (
				func
			&&	isFunction(func)
			&&	(
					func !== getOrLoadImage
				||	node !== target
				)
			);
		}

		if (isImageElement(node)) {
			return node;
		}

	let	pixelData, img;

	//* try converting raw pixel data:

		if (pixelData = getPropByAnyOfNamesChain(node, 'imgData', 'maskData', 'pixelData')) {
		const	imgData = {
				'data' : getPropByAnyOfNamesChain(pixelData, 'data')
			,	'width' : getPropFromAnySource('width', pixelData, target, node)
			,	'height' : getPropFromAnySource('height', pixelData, target, node)
			};

			if (img = await getImageElementFromData(imgData, project)) {
				return img;
			}
		}

	//* try library-provided methods, which internally may use canvas API and possibly premultiply alpha, trading precision for speed:

		for (
			const methodName
			of [
				'loadImage',
				'toImage',
				'toImagePngBlobPromise',
				'toImagePngBase64Promise',
				'toPng',
			]
		) {
			if (img = await getResultPromiseIfMethodExists(methodName)) {
				return img;
			}
		}

		return null;
	}

	async function thisToPngTryEach(...targets) {
	let	img;

		for (const target of targets) if (isNonNullObject(target))
		for (
			const sourceOrTarget
			of (project.loading ? [
				target.sourceData
			,	target
			] : [
				target
			])
		) if (isNonNullObject(sourceOrTarget))
		for (
			const mergedOrNode
			of (layer ? [
				sourceOrTarget
			] : [
				sourceOrTarget.mergedImage
			,	sourceOrTarget.prerendered
			,	sourceOrTarget.thumbnail
			,	sourceOrTarget
			])
		) if (isNonNullObject(mergedOrNode))
		for (
			const imgOrNode
			of [
				mergedOrNode.image
			,	mergedOrNode.img
			,	mergedOrNode
			]
		) if (isNonNullObject(imgOrNode))
		if (img = await thisToPngTryOne(target, imgOrNode)) {

			if (layer) {
				target.img = img;
			} else {
				target.mergedImage = img;
			}

			if (layer) {
				if (layer.top)  img.top  = layer.top;
				if (layer.left) img.left = layer.left;
			}

			if (project) {
				if (
					layer
				&&	!project.imagesLoaded.includes(img)
				) {
					project.imagesLoaded.push(img);
				}

				if (hasPrefix(img.src, BLOB_PREFIX)) {
					addURLToTrackList(img.src, project);
				}
			}

			return img;
		}

		return null;
	}

	try {
		return await thisToPngTryEach(layer || project);
	} catch (error) {
		if (layer) {
			console.error('Failed to get layer or mask image:', [getLayerPathText(layer), error]);
		} else {
			console.error('Failed to get project image:', error);
		}
	}
}

//* Page-specific functions: internal, loading *-------------------------------

function isStopRequestedAnywhere(...sources) {
	return (
		isStopRequested
	||	sources.some(
			(obj) => (
				isNonNullObject(obj)
			&&	(
					obj.isStopRequested
				||	(
						obj.buttonTab
					&&	obj.buttonTab.isStopRequested
					)
				)
			)
		)
	);
}

async function removeProjectView(fileId) {
const	countDeleted = getAllById(fileId).reduce(
		(count, container) => {
			if (container.project) {
				container.project.isStopRequested = true;
			}

			if (del(container)) {
				++count;
			}
		}
	,	0
	);

	if (countDeleted) {
		logTime('"' + fileId + '" closed, ' + countDeleted + ' element(s) removed');
	}
}

async function addProjectViewTab(sourceFile, startTime) {

	if (START_WITH_OPEN_FIRST_MENU_TAB) {
		closeAllDropdownMenuTabs(getAllByClass('menu-bar')[0]);
	}

	if (!sourceFile) {
		return false;
	}

	if (!sourceFile.name) {
		if (sourceFile.url) {
			sourceFile.name = getFileName(getFilePathFromUrl(sourceFile.url));
		}
	}

	if (!sourceFile.name) {
		return false;
	}

	if (!sourceFile.baseName) {
		sourceFile.baseName = getFileBaseName(sourceFile.name);
	}

	if (!sourceFile.ext) {
		sourceFile.ext = getFileExt(sourceFile.name);
	}

//* prepare detached branch of DOM:

const	buttonTab = cre('div', getOneById('loaded-files-selection'));
	buttonTab.className = 'button loading';

const	buttonSelect = cre('div', buttonTab);	//* <- not 'button' tag, because it breaks :hover in CSS in Firefox 56
	buttonSelect.className = 'button-select';

const	buttonThumb = cre('div', buttonSelect);
	buttonThumb.className = 'button-thumbnail';

const	imgHover = cre('div', buttonThumb);
	imgHover.className = 'thumbnail-hover';

const	imgThumb = cre('img', imgHover);
	imgThumb.className = 'thumbnail';

const	buttonText = cre('div', buttonSelect);
	buttonText.className = 'button-text';

const	buttonFileName = cre('div', buttonText);
	buttonFileName.className = 'button-name';
	buttonFileName.textContent = buttonFileName.title = sourceFile.name;

let	buttonStatus;

	if (TAB_STATUS_TEXT) {
		buttonStatus = cre('div', buttonText);
		buttonStatus.className = 'button-status';
	}

const	buttonClose = cre('div', buttonTab);
	buttonClose.className = 'button-close';
	buttonClose.title = getLocalizedText('hint_close_tab');

	buttonClose.setAttribute('onclick', 'closeProject(this)');

	setImageSrc(imgThumb);

const	projectButtons = {
		buttonTab,
		buttonText,
		buttonStatus,
		imgThumb,
		'errorParams' : sourceFile.ext,
		'errorPossible' : 'project_status_error_file_type',
	};

	updateProjectOperationProgress(projectButtons, 'project_status_loading');

let	project, container;

	try {
		project = await getNormalizedProjectData(sourceFile, projectButtons);

		if (project && !isStopRequestedAnywhere(project, projectButtons)) {
			buttonTab.project = project;

			container = (
				await getProjectViewMenu(project)
			||	await getProjectViewImage(project)
			);

			if (isStopRequestedAnywhere(project, projectButtons)) {
				container = null;
			}
		}

		if (container) {
		const	fileId = 'loaded-file: ' + sourceFile.name;

			cleanupObjectTree(
				project
			,	CLEANUP_CHILD_KEYS
			,	(
					TESTING
					? CLEANUP_KEYS_TESTING
					: CLEANUP_KEYS
				)
			);

			container.className = 'loaded-file';
			container.project = project;
			project.container = container;

		let	result = !isStopRequestedAnywhere(project, projectButtons);

			if (result) {
				if (!project.options) {
					buttonTab.className = 'button loaded without-options';

					updateProjectOperationProgress(projectButtons, 'project_status_ready_no_options');
				} else
				if (result = await updateMenuAndShowImg(project) || TESTING) {
					await updateBatchCount(project);

					updateFileNamingPanel(project);
					updateFileNaming(project);

					buttonTab.className = 'button loaded with-options';
				}
			}

//* attach prepared DOM branch to visible document:

			if (result && !isStopRequestedAnywhere(project, projectButtons)) {
				project.isLoaded = true;

				removeProjectView(fileId);
				container.id = buttonTab.id = fileId;

			const	parent = getOneById('loaded-files-view')
				parent.appendChild(container);

				buttonSelect.setAttribute('onclick', 'selectProject(this)');

				if (
					(lastTimeProjectTabSelectedByUser < startTime)
				||	(getAllByClass('show', parent).length === 0)
				) {
					selectProject(buttonSelect, true);
				}

				return true;
			}
		}

//* cleanup on errors or cancel:

	} catch (error) {
		logError(error, arguments);
	}

	buttonTab.className = 'button loading failed';

	if (isStopRequestedAnywhere(project, projectButtons)) {
		project = null;
		projectButtons.errorPossible = 'project_status_aborted';
	}

	updateProjectOperationProgress(
		projectButtons
	,	(
			getPropByNameChain(project, 'loading', 'errorPossible')
		||	getPropByNameChain(projectButtons, 'errorPossible')
		||	'project_status_error'
		)
	,	...asArray(
			getPropByNameChain(project, 'loading', 'errorParams')
		||	getPropByNameChain(projectButtons, 'errorParams')
		||	DUMMY_EMPTY_ARRAY
		)
	);

	setTimeout(() => removeFailedTab(buttonTab), 2000);

	return false;
}

function removeFailedTab(buttonTab) {
	buttonTab.classList.add('fade-out');

	setTimeout(() => del(buttonTab), 800);
}

async function getFileFromLoadingData(data, projectButtons) {

	projectButtons.errorPossible = 'project_status_error_loading_file';
	projectButtons.errorParams = data.name;

	if (isNonNullObject(data)) {
		if (
			!data.file
		&&	data.url
		) {
			data.file = await getFilePromiseFromURL(data.url, 'blob', projectButtons).catch(catchPromiseError);
		}

		return data.file;
	}
}

async function getNormalizedProjectData(sourceFile, projectButtons) {

	async function tryFileParserFunc(func, project) {
		try {
			return await func(project);
		} catch (error) {
			logError(error, arguments);
		}

		return null;
	}

	if (!sourceFile) {
		return null;
	}

	if (READ_FILE_CONTENT_TO_GET_TYPE) {
		if (!sourceFile.file) {
			if (! await getFileFromLoadingData(sourceFile, projectButtons)) {
				return null;
			}
		}
	}

const	{ buttonTab, buttonText, buttonStatus, imgThumb } = projectButtons;

const	fileName = sourceFile.name;
const	baseName = sourceFile.baseName;
const	ext      = sourceFile.ext;
const	mimeType = getPropByNameChain(sourceFile, 'file', 'type');
const	actionLabel = 'processing document structure';

let	loadersTried = 0;
let	project, totalStartTime;

	try_loaders:
	for (const loader of FILE_TYPE_LOADERS)
	if (
		loader.dropFileExts.includes(ext)
	||	loader.inputFileAcceptMimeTypes.includes(mimeType)
	) for (const func of loader.handlerFuncs) {

		projectButtons.errorPossible = 'project_status_error_in_format';

	const	startTime = getTimeNow();

		if (!loadersTried++) {
			totalStartTime = startTime;

			logTime('"' + fileName + '" started ' + actionLabel);
		}

		project = {
			fileName
		,	baseName
		,	buttonTab
		,	buttonText
		,	buttonStatus
		,	'thumbnail' : imgThumb
		,	'foldersCount' : 0
		,	'layersCount' : 0
		,	'imagesCount' : 0
		,	'imagesLoadedCount' : 0
		,	'imagesLoaded' : []
		,	'loading' : {
				startTime
			,	'data' : sourceFile
			,	'images' : []
			,	'errorPossible' : 'project_status_error_in_format'
			}
		};

		if (await tryFileParserFunc(func, project)) {
			break try_loaders;
		} else
		if (isStopRequestedAnywhere(project, projectButtons)) {
			projectButtons.errorPossible = 'project_status_aborted';

			break try_loaders;
		} else {
		const	loadingError = getPropByNameChain(project, 'loading', 'errorPossible');
		const	loadingContext = getPropByNameChain(project, 'loading', 'errorParams');

			if (loadingError) {
				projectButtons.errorPossible = loadingError;

				if (loadingContext) {
					projectButtons.errorParams = loadingContext;
				}
			}
		}

		project = null;
	}

	if (loadersTried > 0) {
	const	tookTime = getTimeNow() - totalStartTime;

		logTime(
			'"' + fileName + '"'
		+	(
				project
				? ' finished ' + actionLabel + ', took '
				: ' stopped by ' + (
					isStopRequestedAnywhere(project, projectButtons)
					? 'request'
					: 'error'
				) + ' while ' + actionLabel + ' after '
			)
		+	tookTime
		+	' ms total'
		);
	} else {
		if (TESTING) console.error(
			'Error: Unknown file type:'
		,	[
				ext
			,	mimeType
			,	fileName
			]
			.filter(arrayFilterNonEmptyValues)
			.filter(arrayFilterUniqueValues)
		);
	}

	if (isStopRequestedAnywhere(project, projectButtons)) {
		return null;
	}

	return project;
}

async function getProjectViewMenu(project) {

	async function preloadProjectImages(project) {

		project.loading.errorPossible = 'project_status_error_in_images';

	const	images = (
			project.loading.images
			.filter(arrayFilterUniqueValues)
			.filter(hasImageToLoad)
		);
	const	imagesCount = project.loading.imagesCount = images.length;
	const	fileName = project.fileName;
	const	actionLabel = (
			PRELOAD_LAYER_IMAGES
			? 'preloading ' + imagesCount + ' images or colors'
			: 'checking colors of ' + imagesCount + ' layers'
		);

		logTime('"' + fileName + '" started ' + actionLabel);

//* try loading one by one to avoid flood of errors:

	const	startTime = getTimeNow();

	let	lastPauseTime = startTime;
	let	result, layer;

		while (
			!isStopRequestedAnywhere(project)
		&&	(images.length > 0)
		&&	(layer = images.pop())
		&&	(result = await getLayerImgLoadPromise(layer, project))
		&&	(result = await getLayerMaskLoadPromise(layer.mask, project))
		) if (
			ADD_PAUSE_AT_INTERVALS
		&&	lastPauseTime + PAUSE_WORK_INTERVAL < getTimeNow()
		) {
			updateProjectLoadedImagesCount(project);

			await pause(PAUSE_WORK_DURATION);

			lastPauseTime = getTimeNow();
		}

	const	tookTime = getTimeNow() - startTime;
	const	loadedCount = project.imagesLoadedCount;
	const	skippedCount = imagesCount - loadedCount;
	const	isStopRequested = isStopRequestedAnywhere(project);
	const	actionSummary = (
			!skippedCount
			? '' : (
				', skipped ' + skippedCount
			+	', loaded ' + loadedCount
			)
		);

		logTime(
			'"' + fileName + '"'
		+	(
				result
				? ' finished ' + actionLabel + actionSummary + ', took '
				: ' stopped by ' + (
					isStopRequested
					? 'request'
					: 'error'
				) + ' while ' + actionLabel + actionSummary + ' after '
			)
		+	tookTime
		+	' ms'
		);

		return isStopRequested ? false : result;
	}

	async function getProjectOptionsContainer(project) {

		try {
			project.loading.errorPossible = 'project_status_error_in_options';

		const	options = getProjectOptions(project);

			if (!options) {
				logTime('"' + project.fileName + '" has no options.');
			} else
			if (await preloadProjectImages(project)) {

				project.loading.errorPossible = 'project_status_error_creating_menu';
				project.options = options;
				project.layersTopSeparated = getLayersTopSeparated(project.layers);

			const	sections = project.optionsOrderOfSections = [];
			const	listsBySection = project.optionsOrderOfListsBySection = {};

				for (const sectionName in options) {
					addToListIfNotYet(sections, sectionName);

					if (SORT_OPTION_LIST_NAMES) {

					const	listNamesPresorted = (
							Object
							.keys(options[sectionName])
							.sort()
						);

						for (const listName of listNamesPresorted) {
						const	listNames = getOrInitChild(listsBySection, sectionName, Array);

							addToListIfNotYet(listNames, listName);
						}
					} else {
						for (const listName in options[sectionName]) {
						const	listNames = getOrInitChild(listsBySection, sectionName, Array);

							addToListIfNotYet(listNames, listName);
						}
					}
				}

//* render default set when everything is ready:

			const	container = createProjectView(project);
				createOptionsMenu(project, getAllByClass('project-options', container)[0] || container);

				return container;
			}
		} catch (error) {
			logError(error, arguments);

			if (project.options) {
				project.options = null;
				delete project.options;
			}
		}

		return null;
	}

	function getProjectOptions(project) {

		function getProcessedLayerInBranch(layer) {

			function getOptionGroup(sectionName, listName) {
				if (!isNonNullObject(options)) {
					options = {};
				}

				sectionName = String(sectionName);
				listName    = String(listName);

			const	section     = getOrInitChild(options, sectionName);
			const	optionGroup = getOrInitChild(section, listName, 'params', 'items');

				return optionGroup;
			}

			function checkSwitchParams(globalOptionParams) {
				for (const switchType in SWITCH_NAMES_BY_TYPE)
				for (const switchName of SWITCH_NAMES_BY_TYPE[switchType])
				if (params[switchName]) {

				const	switchParams = getOrInitChild(project, 'switchParamNames');
				const	switchParam  = getOrInitChild(switchParams, switchType);

					if (!switchParam.implicit) {
						switchParam.implicit = getOtherSwitchParamName(switchType, switchName);
						switchParam.explicit = switchName;
					}

					globalOptionParams[switchName] = true;
				}
			}

			function checkMinMaxParams(params, optionParams, paramName) {
			const	paramMS = params[paramName];

				if (isNonNullObject(paramMS)) {
				const	optionMS = optionParams[paramName];

					if (isNonNullObject(optionMS)) {
						if (optionMS.min > paramMS.min) optionMS.min = paramMS.min;
						if (optionMS.max < paramMS.max) optionMS.max = paramMS.max;
					} else {
						optionParams[paramName] = {
							'min' : paramMS.min
						,	'max' : paramMS.max
						};
					}
				}

			}

			function addOptionGroup(sectionName, listName) {
			const	optionGroup = getOptionGroup(sectionName, listName);
			const	optionParams = optionGroup.params;

				checkSwitchParams(optionParams);
				checkMinMaxParams(params, optionParams, 'multi_select');

				for (const paramName of PARAM_KEYWORDS_SET_VALUE_TO_TRUE) {
					if (params[paramName]) {
						optionParams[paramName] = true;
					}
				}

				return optionGroup;
			}

			function addOptionItem(layer, sectionName, listName, optionName) {
				layer.isOption = true;

				if (!layer.type) {
					layer.type = sectionName.replace(regLayerTypeSingleTrim, '');
				}

			const	optionGroup = getOptionGroup(sectionName, listName);
			const	optionParams = optionGroup.params;
			const	optionItems = optionGroup.items;
			const	optionItemLayers = getOrInitChild(optionItems, optionName, Array);

				if (optionName !== '') {
					for (const paramName of PARAM_KEYWORDS_SET_VALUE_TO_NAME)  {
						if (params[paramName]) {
							optionParams[paramName] = optionName;
						}
					}

					optionItemLayers.push(layer);
				}
			}

			function addOptionsFromParam(sectionName, listName) {

				function addOptionsFromParamKeywords(keywordsList, paramList) {
					for (const optionValue of paramList) {
					let	optionName = String(optionValue);

						if (isRealNumber(optionValue)) {
							optionItems[optionName] = optionValue;
						} else {
							optionName = optionName.replace(regNonAlphaNum, '').toLowerCase();

							if (PARAM_KEYWORDS_SHORTCUT_FOR_ALL.includes(optionName)) {
								for (const optionName of keywordsList) {
									optionItems[optionName] = optionName;
								}
							} else
							if (keywordsList.includes(optionName)) {
								optionItems[optionName] = optionName;
							} else
							if (getRGBAFromColorCodeOrName(optionValue)) {
								optionItems[optionValue] = optionValue;
							}
						}
					}
				}

			const	param = params[sectionName];

				if (!param) {
					return;
				}

				if (!listName && sectionName === 'collage') {
					for (const listName in param) {
						addOptionsFromParam(sectionName, listName);
					}

					return;
				}

			const	optionGroup = addOptionGroup(sectionName, listName || sectionName);
			const	optionParams = optionGroup.params;
			const	optionItems = optionGroup.items;

				checkSwitchParams(optionParams);

				if (sectionName === 'separate') {
					if (!optionParams.totalCount) {
						optionParams.totalCount = 0;
					}

					if (!isNonNullObject(param)) {
						optionParams.useAutoRoot = true;
					} else {
						if (param.useAutoRoot) {
							optionParams.useAutoRoot = true;
						}

					const	naming = param.naming;

						if (naming) {
							optionParams.naming = naming;
						}

					const	groupNames = param.groupNames;

						if (isArray(groupNames)) {
							for (const optionName of groupNames) {
							let	renderedLayers;
							let	renderedCount;

								if (
									layersInside
								&&	(renderedLayers = layer.layers.filter(isLayerRendered))
								&&	(renderedCount = renderedLayers.length) > 0
								&&	getLayerVisibilityChain(layer).every(isLayerRendered)
								) {
								const	optionItemLayers = getOrInitChild(optionItems, optionName, Array);

									if (addToListIfNotYet(optionItemLayers, layer)) {
										optionParams.totalCount += renderedCount;
									}
								}
							}
						}
					}
				} else
				if (sectionName === 'side') {
					for (const optionName of VIEW_SIDES) {
						optionItems[optionName] = getLocalizedText(sectionName + '_' + optionName);
					}

				const	index = VIEW_SIDES.indexOf(param);

					if (index >= 0) {
						params[sectionName] = (
							params.not
							? VIEW_SIDES[index ? 0 : 1]
							: param
						);

						layer.isOnlyForOneSide = true;
					} else
					if (params.if_only) {
						params[sectionName] = VIEW_SIDES[params.not ? 0 : 1];

						layer.isOnlyForOneSide = true;
					} else {
						layer.isOrderedBySide = true;
					}
				} else
				if (sectionName === 'paddings') {
				const	paddings = params['radius'];

					if (isArray(paddings)) {
						for (let padding of paddings) {
							if (isString(padding)) {
								padding = JSON.parse(padding);
							}

						const	{ method, threshold, dimensions } = padding;
						const	isBox = ('x' in dimensions);
						const	[ openBracket, closeBracket ] = (isBox ? '[]' : '()');
						const	optionNameParts = [
								(
									isBox
									? [dimensions.x, dimensions.y]
									: [dimensions.radius]
								).map(
									(interval) => (
										'in' in interval
										? (
											openBracket
										+	interval.in
										+	'..'
										+	interval.out
										+	closeBracket
										)
										: interval.out
									)
								).join('x') + 'px'
							,	(
									!threshold
									? '' :
									'a > ' + threshold
								)
							,	(
									!method
								||	PARAM_KEYWORDS_PADDING_METHODS.indexOf(method) <= 0
									? '' :
									method
								)
							];

						const	optionName = (
								optionNameParts
								.filter(arrayFilterNonEmptyValues)
								.join(', ')
							);

							optionItems[optionName] = padding;
						}
					}

					layer.isMaskGenerated = true;
				} else
				if (sectionName === 'autocrop') {
					addOptionsFromParamKeywords(PARAM_KEYWORDS_AUTOCROP, param);
				} else
				if (sectionName === 'collage') {
					if (listName === 'align') {
						addOptionsFromParamKeywords(PARAM_KEYWORDS_COLLAGE_ALIGN, param[listName]);
					} else
					if (isArray(param[listName])) {
						for (const optionValue of param[listName]) {
						const	optionName = String(optionValue);
							optionItems[optionName] = optionValue;
						}
					}
				} else
				if (sectionName === 'zoom' || sectionName === 'opacities') {
				const	format = param.format;

					if (format) {
						optionParams.format = format;
					}

				const	values = param.values;

					if (isArray(values)) {
						for (const optionValue of values) {

//* pad bare numbers to avoid numeric autosorting in <select>:

						const	optionName = optionValue + '%';

							optionItems[optionName] = (
								sectionName === 'opacities'
								? (orz(optionValue) / 100)
								: optionValue
							);
						}
					}
				}
			}

			if (isLayerSkipped(layer)) {
				return;
			}

		const	params = layer.params;
		const	name = layer.name;
		const	names = layer.names;

			if (!names.length || params.none) {
				names.push('');
			}

		const	layersInside = layer.layers;
		const	layerCopyParams = params.copypaste;

			if (isNonNullObject(layerCopyParams)) {
			const	layerParents = getLayerNestingChain(layer);
			const	sourcesByAlias = getOrInitChild(project, 'layersCopyPasteSourcesByAlias');
			const	targetsByAlias = getOrInitChild(project, 'layersCopyPasteTargetsByAlias');

				for (const paramType in layerCopyParams) {

				const	aliases = (
						paramType === 'copy'
						? sourcesByAlias
						: targetsByAlias
					);

					if (paramType === 'copy') {
						layer.isCopySource = true;
					} else {
						layer.isPasteTarget = true;

//* prevent recursive copypaste, ignore pasting aliases inside any parent labeled as source of that alias:

						layerCopyParams[paramType] = layerCopyParams[paramType].filter(
							(alias) => !layerParents.some(
								(layerParent) => {
								const	aliasesToCopy = getPropByNameChain(
										layerParent.params
									,	'copypaste'
									,	'copy'
									);

									return (
										isArray(aliasesToCopy)
									&&	aliasesToCopy.includes(alias)
									);
								}
							)
						);
					}

					for (const alias of layerCopyParams[paramType]) {
					const	layersByAlias = getOrInitChild(aliases, alias, Array);

						addToListIfNotYet(layersByAlias, layer);
					}
				}
			}

			for (const sectionName of PARAM_OPTIONS_GLOBAL) {
				addOptionsFromParam(sectionName);
			}

			for (const sectionName of PARAM_OPTIONS_FOR_EACH_NAME)
			for (const listName of names) {
				addOptionsFromParam(sectionName, listName);
			}

			if (layer.isOptionList) {
				for (const listName of names) {
					addOptionGroup(layer.type, listName);
				}
			} else {
			let	parent = getParentLayer(layer);

				if (
					parent
				&&	parent.isOptionIfList
				) {
					layer.isOptionIf = true;
				}

				if (
					layer.isInsideColorList
				&&	!layersInside
				) {
					layer.isColor = true;
					parent = getParentLayer(layer, 'isInsideColorList', false);
				}

				if (
					parent
				&&	parent.isOptionList
				&&	(layer.isColor || !layer.isInsideColorList)
				) {
					for (const listName of parent.names)
					for (const optionName of names) {
						addOptionItem(layer, parent.type, listName, optionName);
					}
				}
			}

			if (
				layer.isOption
			||	layer.isOptionIf
			) {
				layer.optionParent = (
					layer.isColor
					? getParentLayer(layer, 'isInsideColorList', false)
					: getParentLayer(layer)
				);
			}

			if (
				!PRELOAD_ALL_LAYER_IMAGES
			&&	layer.opacity > 0
			) {
				project.loading.images.push(layer);
			}

			if (layersInside) {
				layer.layers = getUnskippedProcessedLayers(
					layersInside
				,	layer.isColorList
				||	layer.isInsideColorList
				);
			}

			return layer;
		}

		function getUnskippedProcessedLayers(layers, isInsideColorList) {
		let	clippingLayer;

//* https://stackoverflow.com/questions/30610523/reverse-array-in-javascript-without-mutating-original-array#comment100151603_30610528
//* Compare array cloning methods: https://jsben.ch/lO6C5
//* Top results for Vivaldi (Chrome-based): 1. slice(), 2. [...spread], 3. Array.from()

			for (const layer of layers.slice().reverse()) {
				if (layer.isClipped) {
					layer.clippingLayer = clippingLayer;
				} else {
					clippingLayer = (
						layer.isPassThrough
					&&	!layer.isVirtualFolder
						? null	//* <- clipping to passthrough is not yet supported here (or in SAI2)
						: layer
					);
				}
			}

			if (PRELOAD_ALL_LAYER_IMAGES) {
				project.loading.images.push(...layers);
			}

			return (
				layers
				.filter(
					(layer) => {
						if (isLayerSkipped(layer)) {
							return false;
						} else {
							if (isInsideColorList) {
								layer.isInsideColorList = true;
							}

							return true;
						}
					}
				)
				.map(getProcessedLayerInBranch)
			);
		}

	let	options;

		project.layers = getUnskippedProcessedLayers(project.layers);

		if (options) {

//* Use dummy layers to process default parameters without adding them to the tree:

			for (const sectionName in PARAM_OPTIONS_ADD_BY_DEFAULT)
			if (!options[sectionName]) {

				getProcessedLayerInBranch(
					getLayerWithParamsFromParamList(
						PARAM_OPTIONS_ADD_BY_DEFAULT[sectionName]
					)
				);
			}

//* Set any undefined batch/layout settings to computed default:

			for (const switchType in SWITCH_NAMES_BY_TYPE) {

			const	switchParams = getOrInitChild(project, 'switchParamNames');
			const	switchParam  = getOrInitChild(switchParams, switchType);

				if (!switchParam.implicit) {
				const	switchName = SWITCH_NAMES_DEFAULT[switchType];

					switchParam.implicit = switchName;
					switchParam.explicit = getOtherSwitchParamName(switchType, switchName);
				}
			}

			if (CACHE_UNALTERABLE_FOLDERS_MERGED) {

				function isContentUnalterable(layers) {
					return layers.reduce(
						(isResultUnalterable, layer) => {

						const	isContentAlterable = (
								isArray(layer.layers)
								? !isContentUnalterable(layer.layers)
								: false
							);

						const	isLayerAlterable = (
								isContentAlterable
							||	getPropByAnyOfNamesChain(layer.params.copypaste, ...PARAM_KEYWORDS_PASTE)
							||	(
									layer.params.side
									? VIEW_SIDES.includes(layer.params.side)
									: layer.isVisibilityOptional
								)
							);

							layer.isUnalterable = !(
								isLayerAlterable
							||	layer.isPassThrough
							);

							return (
								isResultUnalterable
							&&	!isLayerAlterable
							&&	!layer.names.some((name) => alterableLayerNames.includes(name))
							);
						}
					,	true
					);
				}

			let	section;
			let	alterableLayerNames = [];
			let	colorListNames = [];

				for (const sectionName of PARAM_OPTIONS_LOCAL) if (section = options[sectionName])
				for (const listName of Object.keys(section)) {
					addToListIfNotYet(alterableLayerNames, listName);

					if (sectionName === 'colors') {
						addToListIfNotYet(colorListNames, listName);
					}
				}

				project.alterableLayerNames = alterableLayerNames.sort();
				project.isUnalterable = isContentUnalterable(project.layers);
				project.mergedImages = [];
			}
		}

		return options;
	}

	function getLayerImgLoadPromise(layer, project) {
		if (layer.layers) {
			if (TESTING > 9) console.log(
				'No image loaded because it is folder at: '
			+	getLayerPathText(layer)
			);

			return true;
		}

	const	colorCode = getPropByNameChain(layer, 'params', 'color_code');

		if (colorCode) {
			layer.img = colorCode;

			if (!VERIFY_PARAM_COLOR_VS_LAYER_CONTENT) {
				if (TESTING > 1) console.log(
					'Got color code in param: '
				+	getColorTextFromArray(colorCode)
				+	', layer content not checked at: '
				+	getLayerPathText(layer)
				);

				return true;
			}
		}

		if (
			!layer.isColor
		&&	!PRELOAD_LAYER_IMAGES
		) {
			return true;
		}

		return getOrLoadImage(project, layer).then(
			(img) => {
				if (isImageElement(img)) {
					if (layer.isColor) {
						layer.img = getFirstPixelRGBA(img);

						if (colorCode) {
						const	colorCodeText = getColorTextFromArray(colorCode);
						const	layerRGBAText = getColorTextFromArray(layer.img);

							if (layerRGBAText !== colorCodeText) {
								console.error(
									'Got color code in param: '
								+	colorCodeText
								+	', prefered instead of layer content: '
								+	layerRGBAText
								+	', at:'
								+	getLayerPathText(layer)
								);
							}

							layer.img = colorCode;
						}
					}

					return true;
				} else
				if (colorCode) {
					if (TESTING) console.log(
						'Got color code in param: '
					+	getColorTextFromArray(colorCode)
					+	', layer content not found at: '
					+	getLayerPathText(layer)
					);

					layer.img = colorCode;

					return true;
				} else
				if (img === null) {
					return true;
				} else {
					if (TESTING) console.error('Image loading failed:', [img, layer]);

					return false;
				}
			}
		).catch(catchPromiseError);
	}

	function getLayerMaskLoadPromise(mask, project) {
		if (
			!mask
		||	!PRELOAD_LAYER_IMAGES
		) {
			return true;
		}

		return getOrLoadImage(project, mask).then(
			(img) => {
				if (
					img === null
				||	isImageElement(img)
				) {
					return true;
				} else {
					if (TESTING) console.error('Image loading failed:', [img, layer]);

					return false;
				}
			}
		).catch(catchPromiseError);
	}

	function createOptionsMenu(project, container) {

		function addOptions(sectionName, entry) {

			function addOptionColor(rgba) {
				if (rgba) {
				const	colorStyle = getColorTextFromArray(rgba, 3);

					if (colorStyle) {
						addToListIfNotYet(colorStyles, colorStyle);
					}
				}
			}

			function getOptionLabelFromColor(colorCode, prefix) {
			const	rgba = getRGBAFromColorCodeOrName(colorCode);
			let	text = String(colorCode);

				if (prefix) {
					text = prefix + ', ' + text;
				}

				if (rgba) {
					addOptionColor(rgba);
					text += ', ' + getColorTextFromArray(rgba);
				}

				return text;
			}

//* section = type of use (fill colors, draw parts, etc):

		const	isZeroSameAsEmpty = (
				ZERO_PERCENT_EQUALS_EMPTY
			&&	NAME_PARTS_PERCENTAGES.includes(sectionName)
			);

		const	section = options[sectionName];
		const	isEntryList = (entry && !isString(entry));
		const	optionLists = (isEntryList ? entry : section);
		let	optionList, colorStyles;

			if (
				sectionName === 'separate'
			&&	(optionList = section[sectionName])
			) {
				section.naming = {
					'items' : {}
				,	'params' : Object.assign({ 'skipInStorageKeys' : true }, DUMMY_OPTION_PARAMS)
				};

				section.group = {
					'items' : {}
				,	'params' : DUMMY_OPTIONAL_PARAMS
				};

			const	items = optionList.items;
			const	params = optionList.params;
			const	groups = section.group.items;
			const	namings = section.naming.items;
			const	separatedLayers = {};

				for (const namingType of SEPARATE_NAMING_TYPES) {
					namings[namingType] = 1;
				}

				if (params.naming) {
					section.naming.params.preselect = params.naming;
				}

				if (params.useAutoRoot) {
				const	defaultGroup = getOrInitChild(items, SEPARATE_GROUP_NAME_DEFAULT, Array);

					addToListIfNotYet(defaultGroup, project.layersTopSeparated);
				}

				for (const optionName in items) {

					groups[optionName] = (
						isString(optionName)
					&&	trim(optionName).length > 0
						? optionName
						: SEPARATE_GROUP_NAME_DEFAULT
					);

					getFlatArray(
						asArray(items[optionName])
						.map((v) => (v.layers || v))
						.filter(arrayFilterUniqueValues)
					)
					.filter(isLayerRendered)
					.forEach(
						(layer, index) => {

						const	partNum = index + 1;
						const	groupName = section.group.items[optionName];
						const	optionLabel = getNestedFilteredArrayJoinedText([
								groupName
							,	'(' + partNum + ')'
							,	layer.name
							], ' ');

							separatedLayers[optionLabel] = {
								'layer' : layer
							,	'group' : groupName
							,	'index' : partNum
							};
						}
					);
				}

				optionList.items = separatedLayers;

				if (TESTING) console.log(sectionName + ' options:', section);
			}

//* list box = set of parts:

			for (const listName in optionLists) if (optionList = section[listName]) {

			const	items = optionList.items;
			const	params = optionList.params;
			const	listLabel = getLocalizedText(
					(isEntryList ? optionLists[listName] : entry)
				||	listName
				);

			let	addEmpty = !(
					sectionName === 'side'
				||	'' in items
				) && (
					params.optional
				// ||	(params.multi_select &&	params.multi_select.min <= 0)
				);

			const	tr = cre('tr', table);
				tr.className = 'project-option';

			const	textColumn = cre('td', tr);
				textColumn.title = listLabel;
				textColumn.textContent = listLabel + ':';

			const	selectColumn = cre('td', tr);
				selectColumn.className = 'option-select';

			const	selectBox = cre('select', selectColumn);
				selectBox.name = listName;
				selectBox.setAttribute('data-section', sectionName);

				if (
					params.noOptionSwitches
				||	sectionName === 'collage'
				) {
					selectColumn.classList.add('no-switches');
					selectBox.noSwitches = true;
				} else
				for (const switchType in SWITCH_NAMES_BY_TYPE) {

				const	implicitName = getPropByNameChain(project, 'switchParamNames', switchType, 'implicit');
				const	explicitName = getPropByNameChain(project, 'switchParamNames', switchType, 'explicit');
				const	isImplied = (typeof params[explicitName] === 'undefined');

					params[implicitName] = isImplied;
					params[explicitName] = !isImplied;

				const	switchNames = SWITCH_NAMES_BY_TYPE[switchType];
				const	switchColumn = cre('td', tr);
					switchColumn.className = 'option-switch';

				const	label = cre('label', switchColumn);
				const	checkBox = cre('input', label);

					checkBox.type = 'checkbox';
					checkBox.className = switchType + '-checkbox';
					checkBox.setAttribute('data-switch-type', switchType);
					checkBox.checked = checkBox.initialValue = !params[SWITCH_NAMES_BY_TYPE[switchType][0]];
					checkBox.params = params;

				const	hintTextParts = [];

					for (const index in switchNames) {

					const	switchName = switchNames[index];
					const	switchClass = switchType + '-' + switchName;
					const	textKey = 'switch_' + switchType + '_' + switchName;
					const	button = cre('div', label);
						button.className = switchClass + ' ' + SWITCH_CLASS_BY_INDEX[index];

						hintTextParts.push(
							SWITCH_LABEL_BY_CLASS[switchClass]
						+	' '
						+	getLocalizedText(textKey)
						+	':'
						+	TITLE_LINE_BREAK
						+	getLocalizedText('hint_' + textKey)
						);
					}

					label.title = hintTextParts.join(DOUBLE_LINE_BREAK)
				}

//* list item = each part:

				for (const optionName in items) {

//* skip empty to add it last:

					if (
						optionName === ''
					||	(
							isZeroSameAsEmpty
						&&	orz(optionName) === 0
						)
					) {
						addEmpty = true;

						continue;
					}

					if (sectionName === 'zoom') {
					const	zoomPercentage = orz(optionName);

						if (
							zoomPercentage === 100
						||	zoomPercentage <= 0
						) {
							if (addedDefaultZoom) {
								continue;
							}

							addedDefaultZoom = true;
							addEmpty = false;

							addOption(selectBox, '100%');

							continue;
						}

						addOption(selectBox, optionName);

						continue;
					} else {
					let	optionLabel = optionName;
					let	optionValue = optionName;

						colorStyles = [];

						function setLocalizedColorOptionLabel(key, colorListNames) {

						const	localizedLabel = getLocalizedOrEmptyText(key);

							if (localizedLabel) {
								optionLabel = localizedLabel;

								return true;
							}

							if (
								!colorListNames
							||	colorListNames.includes(listName)
							) {
								if (
									optionName !== 'transparent'
								&&	isColorTransparent(optionName)
								) {
									if ('transparent' in items) {
										return false;
									}

									optionValue = optionName = 'transparent';
								}

								optionLabel = getOptionLabelFromColor(optionName);
							}

							return true;
						}

						if (sectionName === 'autocrop') {
							if (!setLocalizedColorOptionLabel(sectionName + '_' + optionName)) {
								continue;
							}
						} else
						if (sectionName === 'collage') {
							if (!setLocalizedColorOptionLabel(listName + '_' + optionName, COLOR_LIST_NAMES)) {
								continue;
							}
						} else
						if (sectionName === 'separate' && listName === 'naming') {
							optionLabel = getLocalizedText(sectionName + '_' + listName + '_' + optionName);
						} else
						if (sectionName === 'side') {
							optionLabel = getLocalizedText(sectionName + '_' + optionName);
						} else
						if (sectionName === 'colors') {
							for (const layer of items[optionName]) {
								addOptionColor(layer.img);
							}
						}

					const	optionItem = addOption(selectBox, optionLabel, optionValue);

						for (const colorStyle of colorStyles) {

						//* standard only allows minimal styling of options, no nested color boxes:

							optionItem.style.backgroundColor = colorStyle;
							optionItem.style.color = (
								isColorDark(colorStyle)
								? 'white'
								: 'black'
							);
						}
					}
				}

				if (addEmpty) {
					addOption(selectBox, '', isZeroSameAsEmpty ? '0%' : '');
				}

			const	preselectByValue = getProjectOptionParam(project, sectionName, listName, 'preselect');

				selectBox.initialValue = (
					preselectByValue
					? selectValue(selectBox, preselectByValue)
					: selectValueByPos(selectBox, params.last ? 'bottom' : 'top')
				);

			const	tabCount = getAllByTag('td', tr).length;

				if (maxTabCount < tabCount) {
					maxTabCount = tabCount;
				}
			}
		}

		function addHeader(text) {
		const	th = cre('header', cre('th', cre('tr', table)));
			th.textContent = getLocalizedText(text) + ':';
		}

	const	options = project.options;
	const	table = cre('table', container);

	let	maxTabCount = 0;
	let	addedDefaultZoom = false;

		for (let sections of PROJECT_OPTION_GROUPS) {
			if (sections.header) {
			let	header = sections.header;
				sections = sections.select;

				for (const sectionName in sections) {
					if (options[sectionName]) {
						if (header) {
							addHeader(header);
							header = null;
						}

						addOptions(sectionName, sections[sectionName]);
					}
				}
			} else {
				for (const sectionName in sections) {
					if (options[sectionName]) {
						addHeader(sections[sectionName]);
						addOptions(sectionName);
					}
				}
			}
		}

		for (const cell of getAllByTag('th', table)) {
			cell.colSpan = maxTabCount;
		}

		for (const cell of getAllByClass('no-switches', table)) {
			cell.colSpan = maxTabCount - getAllByTag('td', cell.parentNode).length + 1;
		}
	}

	return await getProjectOptionsContainer(project);
}

function createProjectView(project) {
const	container = cre('div');

const	projectTitle = cre('header', container);
	projectTitle.className = 'filename';
	projectTitle.textContent = project.fileName;

const	buttonsPanel = cre('div', container);
	buttonsPanel.className = 'panel row wrap';

	if (TESTING && project.options) {
	const	fileSaveTitle = cre('header', container);
		fileSaveTitle.className = 'panel row';

	const	fileSaveNamePretext = cre('div', fileSaveTitle);
		fileSaveNamePretext.className = 'pretext';
		fileSaveNamePretext.textContent = getLocalizedText('saved_file_naming_preview') + ':';

	const	fileSaveNamePreview = project.currentFileNamePreview = cre('div', fileSaveTitle);
		fileSaveNamePreview.className = 'filename';
		fileSaveNamePreview.textContent = project.baseName + '.png';

	const	fileNaming = cre('div', container);
		fileNaming.className = 'panel row';

	const	fileNamingBox = cre('div', fileNaming);
		fileNamingBox.className = 'sub panel';

	const	fileNamingButtons = cre('div', fileNamingBox);
		fileNamingButtons.className = 'panel row';

		for (const buttonName of PROJECT_NAMING_BUTTON_NAMES) {
			addNamedButton(fileNamingButtons, buttonName);
		}

	const	fileNamingOrderBox = project.fileNamingOrderBox = cre('div', fileNamingBox);
		fileNamingOrderBox.className = 'panel draggable-order';

		addEventListeners(fileNamingOrderBox, PROJECT_NAMING_EVENT_HANDLERS);

		for (const sectionName of NAME_PARTS_ORDER) {
		const	optionLists = project.options[sectionName];

			if (!isNonNullObject(optionLists)) {
				continue;
			}

		const	listNames = Object.keys(optionLists);
		const	isOnlySectionName = !(
				listNames.length > 0
			&&	listNames.some((listName) => (listName !== sectionName))
			);

		let	fileNamingSection;

			for (const listName of listNames) {

				if (!fileNamingSection) {
					fileNamingSection = cre('div', fileNamingOrderBox);
					fileNamingSection.className = 'sub panel row section';
					fileNamingSection.setAttribute('data-section', sectionName);
					fileNamingSection.draggable = true;

				const	fileNamingSectionName = cre('header', fileNamingSection);
					fileNamingSectionName.textContent = getCapitalizedString(
						getLocalizedOrEmptyText('option_header_' + sectionName)
					||	getLocalizedOrEmptyText('option_' + sectionName)
					||	sectionName
					);

					if (listNames.length > 1) {
						fileNamingSection = cre('div', fileNamingSection);
						fileNamingSection.className = 'panel row wrap';
					}
				}

				if (isOnlySectionName) {
					break;
				}

			const	fileNamingListName = cre('div', fileNamingSection);
				fileNamingListName.className = 'sub panel list-name';
				fileNamingListName.setAttribute('data-list-name', listName);
				fileNamingListName.textContent = listName;

				if (listNames.length > 1) {
					fileNamingListName.draggable = true;
				}
			}
		}
	}

//* show overall project info:

const	summary = cre('div', buttonsPanel);
	summary.className = 'sub panel';

const	summaryBody = cre('div', summary);
const	summaryFooter = cre('footer', summary);
	summaryFooter.className = 'panel';

const	bitDepthText = (
		project.channels && project.bitDepth
		? getLocalizedText('project_bits_channels', project.channels, project.bitDepth)
		: project.channels ? getLocalizedText('project_channels', project.channels)
		: project.bitDepth ? getLocalizedText('project_bits', project.bitDepth)
		: ''
	);

const	colorModeText = project.colorMode || '';
const	canvasSizeText = getLocalizedText('project_pixels', project.width, project.height);
const	resolutionText = getNestedFilteredArrayJoinedText([canvasSizeText, bitDepthText, colorModeText], ', ');

const	foldersCount = project.foldersCount;
const	layersCount  = project.layersCount;
const	imagesCount  = project.imagesCount || (project.imagesCount = project.loading.imagesCount);
const	imagesCountStubHTML = (imagesCount ? '<span class="project-images-loaded"></span>' : '');
const	layersTextParts = [];

	if (layersCount)  layersTextParts.push(getLocalizedText('project_layers', layersCount));
	if (foldersCount) layersTextParts.push(getLocalizedText('project_folders', foldersCount));

const	layersText = getNestedFilteredArrayJoinedText(layersTextParts, ', ');

const	sourceFile = project.loading.data.file || {};
const	sourceFileTime = project.lastModTime = sourceFile.lastModified || sourceFile.lastModifiedDate;
const	fileSizeText = (sourceFile.size ? getFormattedFileSize(sourceFile.size) : '');
const	fileTimeText = (sourceFileTime ? getLocalizedText('file_date', getFormattedTime(sourceFileTime)) : '');

const	summaryTextParts = [
		fileTimeText,
		fileSizeText,
		resolutionText,
		layersText,
		imagesCountStubHTML,
	];

	summaryBody.innerHTML = getNestedFilteredArrayJoinedText(summaryTextParts, '<br>');
	project.imagesLoadedCountText = getAllByClass('project-images-loaded', summaryBody)[0];
	updateProjectLoadedImagesCount(project);

	for (const buttonName of PROJECT_FILE_CONTROLS) {
		addNamedButton(summaryFooter, buttonName);
	}

//* add batch controls:

	if (project.options) {
		for (const controlGroup of PROJECT_VIEW_CONTROLS) {
		const	buttonsGroup = cre('div', buttonsPanel);
			buttonsGroup.className = 'sub panel';

		const	buttonsHeader = cre('header', buttonsGroup);
			buttonsHeader.textContent = getLocalizedText(controlGroup.header) + ':';

			addButtonGroup(buttonsGroup, controlGroup.buttons);
		}

		container.addEventListener('change', onProjectMenuUpdate, false);

//* add place for options menu and results:

	const	renderingPanel = cre('div', container);
		renderingPanel.className = 'panel row';

	const	renderingOptions = cre('div', renderingPanel);
		renderingOptions.className = 'project-options';

	const	renderedImages = cre('div', renderingPanel);
		renderedImages.className = 'project-render';
	}

	container.addEventListener('click', onProjectButtonClick, false);

	return container;
}

function setProjectThumbnail(project, img, onLoad, onError) {
	try {
		if (
			img
		&&	project
		&&	project.thumbnail
		) {
		const	imgOrPart = (
				TAB_THUMBNAIL_TRIMMED || TAB_THUMBNAIL_ZOOM_TRIMMED
				? getCroppedCanvasCopy(project, img)
				: img
			) || img;

		let	canvas = getResizedCanvasFromImg(
				(
					TAB_THUMBNAIL_TRIMMED
					? imgOrPart
					: img
				)
			,	TAB_THUMBNAIL_SIZE || THUMBNAIL_SIZE
			);

			if (canvas) {
				setImageSrc(project.thumbnail, canvas.toDataURL(), onLoad, onError);
			} else
			if (onError) {
				onError(canvas);
			}

			if (TAB_THUMBNAIL_ZOOM) {
			let	preview = project.thumbnail.nextElementSibling;

				if (!preview) {
				const	container = project.thumbnail.parentNode;
					toggleClass(container, 'thumbnail-hover', 1);

					preview = cre('img', container);
					preview.className = 'thumbnail larger';
				}

				canvas = getResizedCanvasFromImg(
					(
						TAB_THUMBNAIL_ZOOM_TRIMMED
						? imgOrPart
						: img
					)
				,	TAB_PREVIEW_SIZE || PREVIEW_SIZE
				);

				if (canvas) {
					setImageSrc(preview, canvas.toDataURL());
				}
			}
		} else
		if (onError) {
			onError(img);
		}
	} catch (error) {
		logError(error, arguments);

		if (onError) {
			onError(error);
		}
	}
}

async function getProjectMergedImagePromise(project, flags) {
	if (isStopRequestedAnywhere(project)) {
		return;
	}

	if (isNonNullObject(project)) {
		if (!isNonNullObject(flags)) {
			flags = {};
		}

	const	{ alsoSetThumbnail, waitForThumbnail } = flags;
	const	img = project.mergedImage || await getOrLoadImage(project);

		return new Promise(
			(resolve, reject) => resolvePromiseOnImgLoad(
				img
			,	(img) => {
					if (
						alsoSetThumbnail
					&&	waitForThumbnail
					) {
						setProjectThumbnail(project, img, resolve, reject);
					} else {
						resolve(img);

						if (alsoSetThumbnail) {
							setProjectThumbnail(project, img);
						}
					}
				}
			,	reject
			)
		).catch(catchPromiseError);
	}
}

async function getProjectViewImage(project) {
const	img = await getProjectMergedImagePromise(project, FLAG_PROJECT_SET_THUMBNAIL);

	if (isStopRequestedAnywhere(project)) {
		return;
	}

	if (img) {
		makeElementFitOnClick(img);

	const	container = createProjectView(project);
	const	header = getAllByTag('header', container)[0];
	const	footer = getAllByTag('footer', container)[0];

	const	comment = (
			footer
			? cre('header', footer, footer.firstElementChild)
			: header || cre('header', container)
		);

		comment.innerHTML = getLocalizedHTML('no_options');

	const	preview = cre('div', container);
		preview.className = 'project-prerender';
		preview.appendChild(img);

		return container;
	}

	return null;
}

function isParamInLayerName(name) {
	while (
		name
	&&	name.length > 0
	) {
	const	paramStart = name.indexOf('[');

//* no "[param]", nothing else to see:

		if (paramStart < 0) {
			return false;
		}

	const	commentStart = name.indexOf('(');

//* has "[param]" and no "(comment)":

		if (commentStart < 0) {
			return true;
		}

//* has "[param]" before "(comment)":

		if (paramStart < commentStart) {
			return true;
		}

	const	commentEnd = name.indexOf(')', commentStart);

//* the rest is unclosed "(comment...", nothing else to see:

		if (commentEnd < 0) {
			return false;
		}

//* continue looking after "(comment)":

		name = name.substr(commentEnd + 1);
	}

	return false;
}

function getLayerWithParamsFromParamList(paramList, layer) {

	function addUniqueParamValuesToList(...args) {
	let	collection = params;

		while (args.length > 2) {
			collection = getOrInitChild(collection, args.shift());
		}

		if (args.length > 1) {
			collection = getOrInitChild(collection, args[0], Array);

			for (const value of asArray(args[1])) {
				addToListIfNotYet(collection, value);
			}
		}
	}

	function getParamValueOrLayerNamesOrDefault(value, fallback) {
		return (
			isString(value) ? value :
			isNonEmptyArray(layer.names) ? layer.names :
			fallback
		) || '';
	}

	function getSlashSeparatedParts(text) {
		return (
			String(text)
			.split('/')
			.filter(arrayFilterNonEmptyValues)
		);
	}

	function getWIPLayerPathText() {
		return getLayerPathText(layer.parent) + '"' + (layer.nameOriginal || layer.name) + '"';
	}

	if (!layer) {
		layer = Object.assign({}, DUMMY_LAYER);
	}

const	params = getOrInitChild(layer, 'params');

	if (!isArray(paramList)) {
		return layer;
	}

	paramList = paramList.filter(arrayFilterUniqueValues);

	param_list:
	for (const param of paramList) {
	let	match;

		param_types:
		for (const paramType in regLayerNameParamType)
		if (match = param.match(regLayerNameParamType[paramType])) {

			if (paramType in SWITCH_NAMES_BY_TYPE) {
				params[SWITCH_NAMES_BY_TYPE[paramType][match[1] ? 0 : 1]] = true;
			} else

			if (NAME_PARTS_FOLDERS.includes(paramType)) {
				layer.type = paramType;
				layer.isVisibilityOptional = true;
			} else

			if (paramType === 'zoom' || paramType === 'opacities') {
			const	values = getUniqueNumbersArray(match[1]);
			const	format = orz(match[2]);
			const	collection = params[paramType];

				if (collection) {
					for (const value of values) {
						addToListIfNotYet(collection.values, value);
					}

					collection.format = format;
				} else {
					params[paramType] = { values, format };
				}
			} else

			if (paramType === 'radius') {
				layer.isVisibilityOptional = true;

			let	methods = [];
			let	thresholds = [];
			let	boundaries = [];

			const	paramTextParts = getSlashSeparatedParts(param.toLowerCase());

				for (const paramTextPart of paramTextParts) {

				//* methods:

					if (PARAM_KEYWORDS_SHORTCUT_FOR_ALL.includes(paramTextPart)) {
						for (const keyword of PARAM_KEYWORDS_PADDING_METHODS) {
							addToListIfNotYet(methods, keyword);
						}
					} else
					if (PARAM_KEYWORDS_PADDING_METHODS.includes(paramTextPart)) {
						addToListIfNotYet(methods, paramTextPart);
					} else

				//* thresholds:

					if (
						hasPrefix(paramTextPart, 'at')
					||	(paramTextPart.replace(regNumDots, '') === 'a')
					) {
					const	values = getRangeValuesFromText(
							paramTextPart
							.replace(regTrimParamRadius, '')
						);

						for (const value of values) {
							addToListIfNotYet(thresholds, Math.abs(orz(value)));
						}

					} else

				//* boundaries:

					if (
						hasPostfix(paramTextPart, 'px')
					||	(paramTextPart.replace(regNumDots, '') === '')
					) {
					let	isHollow = false;

					const	dimensions = (
							paramTextPart
							.replace(regTrimParamRadius, '')
							.split('x', 2)
							.map(
								(dimensionText) => (
									!dimensionText.length
									? null :
									dimensionText
									.split(':', 2)
									.map(
										(boundaryText) => (
											!boundaryText.length
											? null :
											getRangeValuesFromText(boundaryText)
										)
									)
								)
							)
						);

					const	explicitDimensions = (
							dimensions
							.map(
								(dimensionBoundaries) => {
									if (isArray(dimensionBoundaries)) {
										if (dimensionBoundaries.length > 1) {
											isHollow = true;
										}

									const	explicitBoundaries = (
											dimensionBoundaries
											.filter(arrayFilterNonEmptyValues)
										);

										if (explicitBoundaries.length > 0) {
											return explicitBoundaries;
										}
									}

									return null;
								}
							)
							.filter(arrayFilterNonEmptyValues)
						);

					const	isBox = (explicitDimensions.length > 1);
					const	isRound = (explicitDimensions.length === 1) && (dimensions.length === 1);
					const	isSquare = (explicitDimensions.length === 1) && (dimensions.length > 1);

					let	count = 0;

						if (isRound || isSquare) {
						const	directions = explicitDimensions[0];
						const	addToBoundaryList = (
								isRound
								? (interval) => {
									count += addToListIfNotYet(
										boundaries
									,	{
											'radius' : interval
										}
									);
								}
								: (interval) => {
									count += addToListIfNotYet(
										boundaries
									,	{
											'x' : interval
										,	'y' : interval
										}
									);
								}
							);

							if (directions.length > 1) {
								forEachSetInCrossProduct(
									directions
								,	(...args) => {
									const	interval = {
											'in'  : Math.min(...args)
										,	'out' : Math.max(...args)
										};

										addToBoundaryList(interval);
									}
								);
							} else {
								for (const outerRadius of directions[0]) {
								const	interval = (
										isHollow
										? {
											'in'  : outerRadius
										,	'out' : outerRadius
										}
										: {
											'out' : outerRadius
										}
									);

									addToBoundaryList(interval);
								}
							}
						} else
						if (isBox) {
							if (isHollow) {
								forEachSetInCrossProduct(
									[
										dimensions[0][0] || DUMMY_NULL_ARRAY
									,	dimensions[0][1] || DUMMY_NULL_ARRAY
									,	dimensions[1][0] || DUMMY_NULL_ARRAY
									,	dimensions[1][1] || DUMMY_NULL_ARRAY
									]
								,	(x1, x2, y1, y2) => {
										if (x1 === null) x1 = x2; else
										if (x2 === null) x2 = x1;
										if (y1 === null) y1 = y2; else
										if (y2 === null) y2 = y1;

										if (
											x1 === null
										||	x2 === null
										||	y1 === null
										||	y2 === null
										) {
											return;
										}

										count += addToListIfNotYet(
											boundaries
										,	{
												'x' : {
													'in'  : Math.min(x1, x2)
												,	'out' : Math.max(x1, x2)
												}
											,	'y' : {
													'in'  : Math.min(y1, y2)
												,	'out' : Math.max(y1, y2)
												}
											}
										);
									}
								);
							} else {
								forEachSetInCrossProduct(
									[
										dimensions[0][0] || dimensions[0][1]
									,	dimensions[1][0] || dimensions[1][1]
									]
								,	(outerX, outerY) => {
										if (
											outerX === null
										||	outerY === null
										) {
											return;
										}

										count += addToListIfNotYet(
											boundaries
										,	{
												'x' : { 'out' : outerX }
											,	'y' : { 'out' : outerY }
											}
										);
									}
								);
							}
						}
					}
				}

				if (
					boundaries.length > 0
				||	methods.length > 0
				||	thresholds.length > 0
				) {
				const	collection = getOrInitChild(params, paramType, Array);

					if (!boundaries.length) {
						boundaries = [{ 'radius' : { 'out' : DEFAULT_ALPHA_MASK_PADDING } }];
					}

					if (!methods.length) {
						methods = [PARAM_KEYWORDS_PADDING_METHODS[0]];
					}

					if (!thresholds.length) {
						thresholds = [DEFAULT_ALPHA_MASK_THRESHOLD];
					}

					forEachSetInCrossProduct(
						[methods, thresholds, boundaries]
					,	(method, threshold, dimensions) => {
							addToListIfNotYet(
								collection
							,	orderedJSONstringify({ method, threshold, dimensions })
							);
						}
					);
				}
			} else

			if (paramType === 'multi_select') {
			const	values = (
					match[1] === 'optional' ? [0,1] :
					match[1] === 'required' ? [1,1] :
					getNumbersArray(match[2], 2)
				);

			const	limits = params[paramType] = {
					'min' : Math.max(0, values[0])
				,	'max' : Math.max(1, values[values.length > 1 ? 1 : 0])
				};

				if (limits.min > 0) {
					params.required = true;
				} else {
					params.optional = true;
				}
			} else

			if (paramType === 'preselect') {
				params[match[2] || paramType] = true;
			} else

			if (paramType === 'check_order') {
				params[paramType] = match[1];
			} else

			if (paramType === 'copypaste') {
				addUniqueParamValuesToList(
					paramType
				,	match[1]
				,	getParamValueOrLayerNamesOrDefault(match[2])
				);
			} else

			if (paramType === 'separate') {

//* designated root separation into a named group:

				if (
					!SEPARATE_PARAM_NAMES_DEFAULT.includes(match[1])
				||	match[2]
				||	match[3]
				||	match[4]
				) {
					addUniqueParamValuesToList(
						paramType
					,	'groupNames'
					,	getParamValueOrLayerNamesOrDefault(
							match[4]
						,	SEPARATE_GROUP_NAME_DEFAULT
						)
					);

					params[paramType].naming = (match[2] && !match[3] ? 'numbered' : 'equal');
				} else {

//* use automatic root separation:

					getOrInitChild(params, paramType).useAutoRoot = true;

					params[paramType].naming = 'numbered';
				}
			} else

			if (paramType === 'autocrop') {
				addUniqueParamValuesToList(
					paramType
				,	getSlashSeparatedParts(match[2] || DEFAULT_AUTOCROP)
				);
			} else

			if (paramType === 'collage') {
				for (const value of getSlashSeparatedParts(match[2] || DEFAULT_COLLAGE)) {

				let	listName = 'background';
				let	match, values;

				const	keyword = value.replace(regNonAlphaNum, '').toLowerCase()

					if (
						PARAM_KEYWORDS_COLLAGE_ALIGN.includes(keyword)
					||	PARAM_KEYWORDS_SHORTCUT_FOR_ALL.includes(keyword)
					) {
						listName = 'align';
					} else
					if (match = value.match(regEndsWithNumPx)) {
						listName = match[1];

						if (
							!listName
						||	!PARAM_KEYWORDS_COLLAGE_PAD.includes(listName)
						) {
							listName = PARAM_KEYWORDS_COLLAGE_PAD;	//* <- add same value to all lists
						}

						values = (
							getRangeValuesFromText(value)
							.map(
								(value) => (
									Math.abs(orz(value)) + 'px'
								)
							)
						);

						if (!values.length) {
							values.push(match[2] + 'px');
						}
					}

					if (listName) {
					const	listNames = asArray(listName);

						for (const listName of listNames) {
							addUniqueParamValuesToList(
								paramType
							,	listName
							,	values || value
							);
						}
					}
				}
			} else

			if (paramType === 'color_code') {
				params[paramType] = getRGBAFromColorCodeMatch(match);
			} else {
				if (paramType === 'side') {
					layer.isVisibilityOptional = true;

				const	side = match[2];

					if (side) {
						if (side[0] === 'h') layer.flipSide = orz(layer.flipSide) | FLAG_FLIP_HORIZONTAL; else
						if (side[0] === 'v') layer.flipSide = orz(layer.flipSide) | FLAG_FLIP_VERTICAL;
					}
				}

				params[paramType] = param || paramType;
			}

			if (TESTING > 9) console.log('Known param type:', [paramType, param, getWIPLayerPathText()]);

			// break param_types;
			continue param_list;
		}

	const	colorCode = getRGBAFromColorCodeOrName(param);

		if (colorCode) {
			params.color_code = colorCode;

			continue param_list;
		}

		if (TESTING) console.error('Unknown param type:', [param, getWIPLayerPathText()]);
	}

	return layer;
}

async function getNextParentAfterAddingLayerToTree(layer, sourceData, nameOriginal, parentGroup, isLayerFolder, isInsideVirtualPath) {
	if (
		!isInsideVirtualPath
	&&	(
			isLayerFolder
			? ADD_PAUSE_BEFORE_EACH_FOLDER
			: ADD_PAUSE_BEFORE_EACH_LAYER
		)
	) {
		await pause(1);
	}

const	paramList = [];
const	params = {};

	if (typeof layer.sourceData   === 'undefined') layer.sourceData   = sourceData;
	if (typeof layer.nameOriginal === 'undefined') layer.nameOriginal = nameOriginal;

let	name = nameOriginal.replace(regTrimCommaSpace, '');

const	checkVirtualPath = (
		isInsideVirtualPath
	||	isParamInLayerName(name)
	);

//* common sense and generalization fixes:

	if (layer.blendMode === BLEND_MODE_CLIP) {
		layer.blendMode = BLEND_MODE_NORMAL;
		layer.isClipped = true;
	}

	if (layer.blendMode === BLEND_MODE_PASS) {
		layer.blendMode = BLEND_MODE_NORMAL;
		layer.isPassThrough = true;
	}

	if (layer.isPassThrough) {
		if (isLayerFolder) {
			layer.blendMode = BLEND_MODE_NORMAL;
		} else {
			layer.isPassThrough = false;
		}
	}

//* make virtual subfolder from layer name:

let	isSubLayerFolder = false;
let	match, separator, subLayer;

	while (match = name.match(regLayerNameParamOrComment))
	if (
		checkVirtualPath
	&&	(separator = match[2])
	&&	(separator === '/')
	) {
		subLayer = layer;
		isSubLayerFolder = isLayerFolder;
		isLayerFolder = true;
		name          = match[1].replace(regTrimCommaSpace, '');
		subLayer.name = match[4].replace(regTrimCommaSpace, '');

		layer = {
			subLayer
		,	nameOriginal
		,	'isVirtualFolder' : true
		,	'isVisible' : true
		,	'opacity' : 1
		};

		for (const key in VIRTUAL_FOLDER_TAKEOVER_PROPERTIES) {

		const	defaultValue = VIRTUAL_FOLDER_TAKEOVER_PROPERTIES[key];

			if (subLayer[key] !== defaultValue) {
				layer[key] = subLayer[key];
				subLayer[key] = defaultValue;
			} else {
				layer[key] = defaultValue;
			}
		}

		layer.isPassThrough = (layer.blendMode === BLEND_MODE_NORMAL);

		break;
	} else {

//* gather "[params]", remove "(comments)":

	const	paramGroupText = match[3];

		if (isNotEmptyString(paramGroupText)) {
			paramGroupText
			.split(regSplitParam)
			.map(trimParam)
			.filter(arrayFilterNonEmptyValues)
			.forEach((param) => paramList.push(param.toLowerCase()));
		}

		name = (
			(match[1] + ', ' + match[4])
			.replace(regTrimCommaSpace, '')
		);
	}

//* process params:

	layer.name = name;
	layer.names = (
		name
		.split(regSplitLayerNames)
		.map(trim)
		.filter(arrayFilterNonEmptyValues)
		.filter(arrayFilterUniqueValues)
	);

	layer.params = params;
	layer.parent = parentGroup;

	if (paramList.length > 0) {
		getLayerWithParamsFromParamList(paramList, layer);

	const	layerType = layer.type;

		if (isNotEmptyString(layerType)) {
			if (params.if_only) {
				if (params.any) {
					layer.isOptionIfAny = true;
				} else
				if (isLayerFolder) {
					layer.isOptionIfList = true;
				} else {
					delete layer.type;
				}
			} else {
				if (isLayerFolder) {
					if (NAME_PARTS_FOLDERS.includes(layerType)) {
						layer.isOptionList = true;

						if (layerType === 'colors') {
							layer.isColorList = true;
						}
					}
				} else {
					delete layer.type;
				}
			}
		}
	}

//* place the layer into custom generic tree structure:

	parentGroup.push(layer);

const	paramName = 'check_order';

	if (!params[paramName]) {
	const	parentValue = getPropByNameChain(getParentLayer(layer), 'params', paramName);

		if (parentValue) {
			params[paramName] = parentValue;
		}
	}

	if (isLayerFolder) {
		parentGroup = layer.layers = [];
		parentGroup.parent = layer;

//* add content to virtual subfolder:

		if (subLayer) {
			parentGroup = await getNextParentAfterAddingLayerToTree(
				subLayer
			,	sourceData
			,	subLayer.name
			,	parentGroup
			,	isSubLayerFolder
			,	true
			);
		}
	}

	return parentGroup;
}

async function addLayerGroupCommonWrapper(project, parentGroup, layers, callback) {
	for (const layer of layers) {

		if (isStopRequestedAnywhere(project)) {
			return false;
		}

		await callback(layer, parentGroup);
	}

	return true;
}

function updateProjectLoadedImagesCount(project) {

const	element = project.imagesLoadedCountText;
const	imagesCount = project.imagesCount;
const	loadedCount = project.imagesLoaded.length;
const	notChanged = (project.imagesLoadedCount === loadedCount);

	if (!ADD_WIP_TEXT_ROLL && notChanged) {
		return;
	}

	project.imagesLoadedCount = loadedCount;

	if (!project.isLoaded || !project.rendering) {
		updateProjectOperationProgress(
			project
		,	'project_status_reading_images'
		,	loadedCount
		,	imagesCount
		);
	}

	if (!element || notChanged) {
		return;
	}

	element.textContent = (
		loadedCount
	&&	loadedCount !== imagesCount
		? getLocalizedText('project_images_loaded', loadedCount, imagesCount)
		: getLocalizedText(
			(
				loadedCount
				? 'project_images_loaded_all'
				: 'project_images'
			)
		,	imagesCount
		)
	);

	updateElementMinWidth(element);
}

function updateElementMinWidth(element, ref) { return updateElementFixedWidth(element, ref, 'minWidth'); }
function updateElementMaxWidth(element, ref) { return updateElementFixedWidth(element, ref, 'maxWidth'); }
function updateElementFixedWidth(element, ref, key) {
	if (
		element
	&&	element.style
	) {
		if (!ref) ref = element;
		if (!key) key = 'width';

	const	refWidth = Math.ceil(ref.width || ref.offsetWidth || ref.scrollWidth || ref.clientWidth);
	const	ownWidth = orz(element.style[key]);

		if (TESTING > 9) console.log(
			'updateElementFixedWidth:', [
				'ref:', refWidth, ref,
				(refWidth > ownWidth ? '>' : '<='),
				'target:', ownWidth, element,
			]
		);

		if (refWidth > ownWidth) {
			element.style[key] = refWidth + 'px';

			return true;
		}
	}
}

function updateProjectOperationProgress(context, operation, ...args) {
const	project = context.project || context;

	if (TESTING > 9) console.log(arguments);

	if (operation === 'project_status_ready_options') {
	let	count = args[0];

		if (!isRealNumber(count)) {
		const	precounts = getOrInitChild(project, 'renderBatchCounts');
		const	key = project.renderBatchCountSelectedKey;

			if (count = precounts[key]) {
				args[0] = count;
			} else {
				count = '{too_many}';
			}
		}

		updateMenuBatchCount(project, count);
	}

let	element;

	if (TAB_STATUS_TEXT) {
		if (element = project.buttonStatus) {
			element.title =
			element.textContent = getLocalizedText(operation, ...args);

			if (ADD_WIP_TEXT_ROLL) {
				if (operation.includes('project_status_ready')) {
					toggleClass(element, 'wip', -1);
				} else {
				const	i = WIP_TEXT_ROLL.indexOf(element.getAttribute('data-wip')) + 1;
					element.setAttribute('data-wip', WIP_TEXT_ROLL[i % WIP_TEXT_ROLL.length]);
					toggleClass(element, 'wip', 1);
				}
			}
		}
	} else {
		if (element = project.buttonTab) {
			element.title = getLocalizedText(operation, ...args);
		}
	}

	if (TAB_WIDTH_ONLY_GROW) {
		updateElementMinWidth(project.buttonStatus || project.buttonText || project.buttonTab);
	}
}

function setImageGeometryProperties(target, ...sources) {

	sides:
	for (const keys of IMAGE_GEOMETRY_KEYS) {
	const	targetKey = keys[0];

		if (targetKey in target) {
			continue sides;
		}

		for (const source of sources) if (isNonNullObject(source))
		for (const key of keys) if (source[key]) {
			target[targetKey] = orz(source[key]);

			continue sides;
		}

		// target[targetKey] = 0;
	}
}

//* Page-specific functions: internal, loading from file *---------------------

async function loadCommonWrapper(project, libName, getFileParserPromise, treeConstructorFunc) {

	project.loading.errorPossible = 'project_status_error_loading_library';
	project.loading.errorParams = libName;

	if (! await loadLibOnDemandPromise(libName)) {
		return;
	}

let	sourceData;
const	actionLabel = 'processing document with ' + libName;

	logTime('"' + project.fileName + '" started ' + actionLabel);

	project.loading.errorPossible = 'project_status_error_loading_file';
	project.loading.errorParams = project.fileName;
	project.loading.startParsingTime = getTimeNow();

	try {
	const	file = await getFileFromLoadingData(project.loading.data, project.loading);

		if (file) {
			sourceData = await getFileParserPromise(file).catch(catchPromiseError);
		}
	} catch (error) {
		logError(error, arguments);
	}

	logTime(
		'"' + project.fileName + '"'
	+	(
			sourceData
			? ' finished ' + actionLabel + ', took '
			: ' stopped by ' + (
				isStopRequestedAnywhere(project)
				? 'request'
				: 'error'
			) + ' while ' + actionLabel + ' after '
		)
	+	(getTimeNow() - project.loading.startParsingTime)
	+	' ms'
	);

	if (isStopRequestedAnywhere(project)) {
		return;
	}

	if (sourceData) {

		if (TESTING > 1) console.log(sourceData);

		project.loading.errorPossible = 'project_status_error_in_layers';
		project.sourceData = sourceData;

		if (TAB_THUMBNAIL_PRELOAD) {
			getProjectMergedImagePromise(project, FLAG_PROJECT_SET_THUMBNAIL);
		}

		if (await treeConstructorFunc(project, sourceData)) {
			return (
				project.loading.then
				? await project.loading.then(project)
				: project
			);
		}
	}
}

async function loadORA(project) {
	return await loadCommonWrapper(
		project
	,	'ora.js'
	,	function getFileParserPromise(file) {
			return new Promise(
				(resolve, reject) => {
					try {
						ora.load(
							file
						,	resolve
						,	reject
						,	(stepsDone, stepsTotal) => updateProjectOperationProgress(
								project
							,	'project_status_reading_file'
							,	stepsDone
							,	stepsTotal
							)
						);
					} catch (error) {
						reject(error);
					}
				}
			);
		}
	,	async function treeConstructorFunc(project, sourceData) {
			if (
				!sourceData.layers
			||	!sourceData.layers.length
			) {
				return;
			}

			project.foldersCount	= orz(sourceData.stacksCount);
			project.layersCount	= orz(sourceData.layersCount);
			project.nodesCount	= sourceData.layers.length;

			project.width	= sourceData.width;
			project.height	= sourceData.height;

//* fix for original ora.js:

		let	rootLayers;

			if (
				project.nodesCount
			&&	!project.layersCount
			) {
				project.layersCount = project.nodesCount;
				rootLayers = sourceData.layers.slice().reverse();
			} else {
				rootLayers = sourceData.layers;
			}

//* gather layers into a tree object:

			async function addLayerToTree(layer, parentGroup) {

				function setImageLoadOrCountIfLoaded(imageHolder, newHolder) {
				const	img = getPropByAnyOfNamesChain(imageHolder, 'img', 'image');

				//* already loaded img element:

					if (img && img !== imageHolder) {
						newHolder.img = img;

						project.imagesLoaded.push(img);

						++project.imagesCount;
					} else

				//* deferred loading, only when needed:

					if (imageHolder.loadImage) {
						newHolder.loadImage = (onDone, onError) => {
							imageHolder.loadImage(onDone, onError);
						};

						++project.imagesCount;
					}

					setImageGeometryProperties(newHolder, imageHolder, img);
				}

			const	name = layer.name || '';
			const	mode = layer.composite || '';
			const	modeAlpha = layer.composite_alpha || mode || '';//* <- non-standard, for testing
			const	modeColor = layer.composite_color || mode || '';//* <- non-standard, for testing
			const	mask = layer.mask || null;			//* <- non-standard, for testing
			const	layers = layer.layers || null;
			const	isLayerFolder = (isNonNullObject(layers) && isRealNumber(layers.length));

			const	alphaMode = getNormalizedBlendMode(modeAlpha);
			const	colorMode = getNormalizedBlendMode(modeColor);
			const	blendMode = colorMode || alphaMode || getNormalizedBlendMode(mode);

			const	isPassThrough = (
					blendMode === BLEND_MODE_PASS		//* <- non-standard, for testing
				||	layer.isolation === 'auto'
				);

			const	isClipped = (
					alphaMode === BLEND_MODE_CLIP
				||	getTruthyValue(layer.clipping)		//* <- non-standard, for testing
				);

			const	isVisible = (
					typeof layer.visibility === 'undefined'
				||	layer.visibility === 'visible'
				||	layer.visibility !== 'hidden'
				||	getTruthyValue(layer.visibility)	//* <- non-standard, for testing
				);

			const	layerWIP = {
					isLayerFolder
				,	isPassThrough
				,	isClipped
				,	isVisible
				,	blendMode
				,	'blendModeOriginal' : mode
				,	'blendModeOriginalAlpha' : modeAlpha
				,	'blendModeOriginalColor' : modeColor
				,	'opacity' : orzFloat(layer.opacity)
				};

				if (!isLayerFolder) {
					setImageLoadOrCountIfLoaded(layer, layerWIP);
				}

//* Note: layer masks also may be emulated via compositing modes in ORA

				if (mask) {
					setImageLoadOrCountIfLoaded(mask, layerWIP.mask = {});
				}

				parentGroup = await getNextParentAfterAddingLayerToTree(
					layerWIP
				,	layer
				,	name
				,	parentGroup
				,	isLayerFolder
				);

				++nodesDoneCount;

				if (
					ADD_PAUSE_AT_INTERVALS
				&&	lastPauseTime + PAUSE_WORK_INTERVAL < getTimeNow()
				) {
					updateProjectOperationProgress(
						project
					,	'project_status_reading_layers'
					,	nodesDoneCount
					,	project.nodesCount
					);

					await pause(PAUSE_WORK_DURATION);

					lastPauseTime = getTimeNow();
				}

				if (isStopRequested = isStopRequestedAnywhere(project)) {
					project.loading.errorPossible = 'project_status_aborted';

					return;
				}

				if (isLayerFolder) {
					await addLayerGroupCommonWrapper(project, parentGroup, layers, addLayerToTree);
				}
			}

		let	nodesDoneCount = 0;
		let	lastPauseTime = getTimeNow();
		let	isStopRequested;

			if (isStopRequested) {
				return;
			}

			return await addLayerGroupCommonWrapper(
				project
			,	project.layers = []
			,	rootLayers
			,	addLayerToTree
			);
		}
	);
}

async function loadPSD       (project) { return await loadPSDCommonWrapper(project, 'psd.js', 'PSD_JS'); }
async function loadPSDBrowser(project) { return await loadPSDCommonWrapper(project, 'psd.browser.js', 'PSD'); }

async function loadPSDCommonWrapper(project, libName, varName) {
	return await loadCommonWrapper(
		project
	,	libName
	,	function getFileParserPromise(file) {
			return window[varName].fromDroppedFile(file);
		}
	,	async function treeConstructorFunc(project, sourceData) {

			if (
				!sourceData.layers
			||	!sourceData.layers.length
			) {
				return;
			}

		const	projectHeader = sourceData.header || sourceData;
		const	projectMode = projectHeader.mode;

			project.nodesCount = sourceData.layers.length;

			project.width	= projectHeader.cols || projectHeader.width;
			project.height	= projectHeader.rows || projectHeader.height;
			project.bitDepth = projectHeader.depth;
			project.channels = projectHeader.channels;
			project.colorMode = (
				isRealNumber(projectMode)
				? PSD_COLOR_MODES[projectMode]
				: projectMode
			);

//* gather layers into a tree object:

			function isFolderNode(node) {
				return (
					(isFunction(node.isFolder) && node.isFolder())
				||	(isFunction(node.isLayer) && !node.isLayer())
				||	(isFunction(node.hasChildren) && node.hasChildren())
				);
			}

			async function addLayerToTree(layer, parentGroup) {
			const	node = layer;
				layer = node.layer || node;

			const	layers = (
					[node, layer].some(isFolderNode)
					? node.children()
					: null
				);

			const	isLayerFolder = (isNonNullObject(layers) && isRealNumber(layers.length));
			const	name = getPropFromAnySource('name',  layer, node) || '';
			const	img  = getPropFromAnySource('image', layer, node);
			const	mask = getPropFromAnySource('mask',  layer, node, img);
			const	blending = getPropByAnyOfNamesChain(layer, 'blendMode', 'blending', 'mode');
			const	clipping = getPropByAnyOfNamesChain(layer, 'blendMode', 'clipping', 'clipped');
			const	modePass = getPropByNameChain(layer, 'adjustments', 'sectionDivider', 'obj', 'blendMode');
			const	blendMode = getNormalizedBlendMode(blending);

			const	isPassThrough = (
					regLayerBlendModePass.test(modePass)
				||	regLayerBlendModePass.test(blendMode)
				);

			const	fillOpacity = (
					isFunction(layer.fillOpacity)
					? layer.fillOpacity().layer.adjustments.fillOpacity.obj.value
					: null
				);

			const	hasNoFillOpacityValue = (
					fillOpacity === null
				||	!isRealNumber(fillOpacity)
				);

//* Note:
//*	"Fill" opacity is used in PSD from SAI2
//*	to store opacity value instead of standard opacity
//*	for layers with certain blending modes (non-TS versions).
//* Source: https://github.com/meltingice/psd.js/issues/153#issuecomment-436456896

			const	layerWIP = {
					isLayerFolder
				,	isPassThrough
				,	'isClipped' : getTruthyValue(clipping)
				,	'isVisible' : getTruthyValue(layer.visible)
				,	blendMode
				,	'blendModeOriginal' : blending
				,	'isBlendModeTS' : (
						hasNoFillOpacityValue
					&&	BLEND_MODES_WITH_TS_VERSION.includes(blendMode)
					)
				,	'opacity' : (
						getNormalizedOpacity(layer.opacity)
						* (hasNoFillOpacityValue ? 1 : getNormalizedOpacity(fillOpacity))
					)
				};

				if (img) {
					if (!isLayerFolder) {
					const	data = getPropFromAnySource('pixelData', layer, node, img);

						if (data && data.length > 0) {
							if (GET_LAYER_IMAGE_FROM_BITMAP) {
								layerWIP.imgData = data;
							} else {
								layerWIP.toImage = () => getOrLoadImage(project, layer);
							}

							setImageGeometryProperties(layerWIP, layer, img);

							++project.imagesCount;
						}
					}

					if (
						img.hasMask
					&&	img.maskData
					&&	mask
					&&	!(mask.disabled || (mask.flags & 2))	//* <- mask visibility checkbox, supposedly
					) {
						layerWIP.mask = {
							'defaultColor' : orz(mask.defaultColor)
						,	'imgData' : img.maskData		//* <- RGBA byte array
						};

						setImageGeometryProperties(layerWIP.mask, mask, img);

						++project.imagesCount;
					}
				}

				parentGroup = await getNextParentAfterAddingLayerToTree(
					layerWIP
				,	layer
				,	name
				,	parentGroup
				,	isLayerFolder
				);

				++nodesDoneCount;

				if (
					ADD_PAUSE_AT_INTERVALS
				&&	lastPauseTime + PAUSE_WORK_INTERVAL < getTimeNow()
				) {
					updateProjectOperationProgress(
						project
					,	'project_status_reading_layers'
					,	nodesDoneCount
					,	project.nodesCount
					);

					await pause(PAUSE_WORK_DURATION);

					lastPauseTime = getTimeNow();
				}

				if (isStopRequested = isStopRequestedAnywhere(project)) {
					project.loading.errorPossible = 'project_status_aborted';

					return;
				}

				if (isLayerFolder) {
					++project.foldersCount;

					await addLayerGroupCommonWrapper(project, parentGroup, layers, addLayerToTree);
				} else {
					++project.layersCount;
				}
			}

		let	nodesDoneCount = 0;
		let	lastPauseTime = getTimeNow();
		let	isStopRequested;

			if (isStopRequested) {
				return;
			}

			return await addLayerGroupCommonWrapper(
				project
			,	project.layers = []
			,	sourceData.tree().children()
			,	addLayerToTree
			);
		}
	);
}

//* Page-specific functions: internal, rendering *-----------------------------

function isOptionValueRelevant(project, values, sectionName, listName) {

const	optionName = values[sectionName][listName];

	if (
		REQUIRE_NON_EMPTY_SELECTION
	&&	!optionName
	&&	getProjectOptionParam(project, sectionName, listName, 'required')
	) {
		return false;
	}

	if (
		sectionName === 'separate'
	&&	listName !== 'naming'
	&&	listName !== 'group'
	) {
	const	selectedGroup = values.separate.group;

		if (selectedGroup) {
		const	relevantGroup = getProjectOptionValue(project, sectionName, listName, optionName, 'group');

			if (
				!relevantGroup
			||	selectedGroup !== relevantGroup
			) {
				return false;
			}
		}
	} else {
	const	relevantLayers = getProjectOptionValue(project, sectionName, listName, optionName);

		if (isNonEmptyArray(relevantLayers)) {
			return relevantLayers.some(
				(layer) => getLayerPathVisibilityByValues(project, layer, values, listName)
			);
		}
	}

	return true;
}

function isSelectedOptionRelevant(project, values, sectionName, listName, optionName) {

const	section = values[sectionName];
const	oldOptionName = section[listName];
const	isOptionNameChanged = (oldOptionName !== optionName);

	if (isOptionNameChanged) {
		section[listName] = optionName;
	}

const	result = isOptionValueRelevant(project, values, sectionName, listName);

	if (isOptionNameChanged) {
		section[listName] = oldOptionName;
	}

	return result;
}

function isSetOfValuesOK(project, values) {

	for (const sectionName in values) {
	const	section = values[sectionName];

		for (const listName in section) {
			if (!isOptionValueRelevant(project, values, sectionName, listName)) {
				return false;
			}
		}
	}

	return true;
}

function getSetOfRelevantValues(project, values) {
const	resultSet = {};

	for (const sectionName in values) {
	const	section = values[sectionName];
	const	resultSection = resultSet[sectionName] = {};

		for (const listName in section) {
			resultSection[listName] = (
				isOptionValueRelevant(project, values, sectionName, listName)
				? section[listName]
				: ''
			);
		}
	}

	return resultSet;
}

function selectValueByPos(selectBox, targetPosition) {
	if (
		!selectBox
	||	!selectBox.options
	||	!selectBox.options.length
	) {
		return;
	}

let	newValue = selectBox.value;

	if (targetPosition === 'top') {
		newValue = selectBox.options[0].value;
	} else
	if (targetPosition === 'bottom') {
		newValue = selectBox.options[selectBox.options.length - 1].value;
	} else
	if (targetPosition === 'init') {
		newValue = selectBox.initialValue;
	} else {
		for (const option of selectBox.options)
		if (
			'' === option.value
		||	'' === trim(option.textContent)
		) {
			newValue = option.value;

			break;
		}
	}

	return selectValue(selectBox, newValue);
}

function selectValue(selectBox, newValue) {
	newValue = getJoinedOrEmptyText(newValue);

	if (selectBox.value !== newValue) {
		selectBox.value = newValue;
	}

	updateSelectStyle(selectBox);

	return selectBox.value;
}

function updateSelectStyle(selectBox) {
const	optionItem = getAllByTag('option', selectBox).find(
		(option) => (
			option.selected
		||	option.value === selectBox.value
		)
	);

	if (optionItem) {
		selectBox.style.color = optionItem.style.color || '';
		selectBox.style.backgroundColor = optionItem.style.backgroundColor || '';
	} else {
		selectBox.style.color = '';
		selectBox.style.backgroundColor = '';
	}

//* Set attribute for CSS selectors:

	selectBox.setAttribute(
		'value'
	,	(
			ZERO_PERCENT_EQUALS_EMPTY
		&&	NAME_PARTS_PERCENTAGES.includes(selectBox.getAttribute('data-section'))
		&&	selectBox.value === '0%'
			? '' :
			selectBox.value
		)
	);

	return selectBox.value;
}

function setAllSwitches(project, key, value) {

	for (const checkBox of getAllByType('checkbox', project.container)) {

		if (checkBox.getAttribute('data-switch-type') === key) {
			checkBox.checked = (SWITCH_NAMES_BY_TYPE[key].indexOf(value) > 0);

			updateCheckBox(checkBox);
		}
	}

	if (key !== 'layout') {
		updateFileNaming(project);
	}

	if (key === 'batch') {
		updateBatchCount(project);
	}
}

async function setAllValues(project, targetPosition) {

	for (const selectBox of getAllByTag('select', project.container)) {

		selectValueByPos(selectBox, targetPosition);
	}

	if (
		targetPosition === 'init'
	||	targetPosition === 'empty'
	) {
		for (const checkBox of getAllByType('checkbox', project.container)) {

			checkBox.checked = (
				targetPosition === 'init'
				? checkBox.initialValue
				: false
			);

			updateCheckBox(checkBox);
		}
	}

	await updateBatchCount(project);
	await updateMenuAndShowImg(project);

	updateFileNaming(project);
}

function getSelectedMenuValues(project) {

let	values = project.selectedMenuValues;

	if (values) {
		return values;
	}

	values = getUpdatedMenuValues(project);

	for (const selectBox of getAllByTag('select', project.container)) {

	const	selectValue = selectBox.value;
	const	sectionName = selectBox.getAttribute('data-section');
	const	listName    = selectBox.name;

		values[sectionName][listName] = (
			selectBox.hidden
		||	getPropByNameChain(selectBox, 'options', selectValue, 'hidden')
			? ''
			: selectValue
		);
	}

	return project.selectedMenuValues = values;
}

function getAllMenuValues(project, checkSelectedValue) {
const	values = {};

	for (const selectBox of getAllByTag('select', project.container)) {

	const	sectionName = selectBox.getAttribute('data-section');
	const	listName    = selectBox.name;
	const	optionLists = getOrInitChild(values, sectionName);

		optionLists[listName] = (
			selectBox.noSwitches
		||	(
				checkSelectedValue
			&&	getProjectOptionParam(project, sectionName, listName, 'single')
			)
			? [selectBox.value]
			: getAllByTag('option', selectBox).map((option) => option.value)
		);
	}

	return values;
}

async function getAllValueSets(project, values, startTime, flags) {

	async function goDeeper(optionListIndex) {
	let	isGoingDeeper = true;

	const	[ sectionName, listName, optionNames ] = optionLists[optionListIndex];

		for (const optionName of optionNames) {
			aborted = (
				isStopRequestedAnywhere(thisJob, project)
				|| (
					startTime
				&&	startTime !== project.renderBatchCountStartTime
				)
			);

			if (
				aborted
				|| (
					getOnlyNames
				&&	stopAtMaxCount
				&&	addedCount > MAX_BATCH_PRECOUNT
				)
			) {
				return false;
			}

			valueSetToCheck[sectionName][listName] = optionName;

			if (optionListIndex < maxListIndex) {
				isGoingDeeper = await goDeeper(optionListIndex + 1);
			} else {
				setRenderRootByValues(project, valueSetToCheck);

			const	valueSet = getSetOfRelevantValues(project, valueSetToCheck);
			const	isValid = (
					REQUIRE_NON_EMPTY_SELECTION
					? isSetOfValuesOK(project, valueSet)
					: true
				);

				if (TESTING > 9) console.log(
					[
						'goDeeper:',
						optionListIndex, '/', maxListIndex,
						'=', isValid,
						':', addedCount, 'added',
					].join(' '),
					[
						JSON.stringify(valueSetToCheck),
						JSON.stringify(valueSet),
					]
				);

				if (
					ADD_PAUSE_AT_INTERVALS
				&&	lastPauseTime + PAUSE_WORK_INTERVAL < getTimeNow()
				) {
					updateProjectOperationProgress(
						project
					,	'project_status_counting_batch'
					,	addedCount
					,	maxPossibleCount
					);

					updateMenuBatchCount(
						project
					,	addedCount
					,	maxPossibleCount
					);

					await pause(PAUSE_WORK_DURATION);

					lastPauseTime = getTimeNow();
				}

				if (!isValid) continue;

			const	fileName = getKeyForValueSet(project, valueSet);

				if (getOnlyNames) {
					if (addToListIfNotYet(valueSets, fileName)) {
						++addedCount;
					}
				} else
				if (!(fileName in valueSets)) {
					valueSets[fileName] = valueSet;

					++addedCount;
				}
			}
		}

		return isGoingDeeper;
	}

const	{
		getOnlyNames,
		stopAtMaxCount,
		checkSelectedValue,
	} = (
		isNonNullObject(flags) ? flags : {}
	);

	if (!isNonNullObject(values)) {
		values = getAllMenuValues(project, checkSelectedValue);
	}

const	optionLists = [];
const	valueSetToCheck = {};
let	valueSets = getOnlyNames ? [] : {};
let	aborted = false;
let	addedCount = 0;
let	maxListIndex = 0;
let	maxPossibleCount = 1;
let	section, optionNames, lastPauseTime;

	for (const sectionName in values) if (section = values[sectionName])
	for (const listName in section) if (optionNames = section[listName]) {

		optionLists.push([ sectionName, listName, optionNames ]);

		maxPossibleCount *= optionNames.length;
	}

	if (
		getOnlyNames
	&&	stopAtMaxCount
	&&	maxPossibleCount > MAX_BATCH_PRECOUNT
	) {
		return null;
	}

const	thisJob = { startTime, optionLists };
	pendingJobs.add(thisJob);

	if (optionLists.length > 0) {
		maxListIndex = optionLists.length - 1;

		for (const sectionName in values) {
			valueSetToCheck[sectionName] = {};
		}

		if (TESTING > 9) console.log(
			'getAllValueSets:',
			valueSetToCheck,
			optionLists.map(String),
		);

		if (ADD_PAUSE_AT_INTERVALS) {
			lastPauseTime = startTime || getTimeNow();
		}

		if (! await goDeeper(0)) {
			valueSets = getOnlyNames ? null : {};
		}
	}

	pendingJobs.delete(thisJob);

	if (aborted) {
		return;
	}

	setRenderRootByValues(project, null);

	return valueSets;
}

async function getAllValueSetsCount(project, values, startTime) {
const	valueSets = await getAllValueSets(
		project
	,	values
	,	startTime
	,	{
			'getOnlyNames' : true,
			'checkSelectedValue' : true,
			'stopAtMaxCount' : MAX_BATCH_PRECOUNT && MAX_BATCH_PRECOUNT > 0,
		}
	);

	if (typeof valueSets === 'undefined') {
		return;
	}

	if (valueSets === null) {
		return '{too_many}';
	}

	return valueSets.length;
}

function getUpdatedMenuValues(project, updatedValues) {
	setRenderRootByValues(project, updatedValues);

const	values = {};

	for (const selectBox of getAllByTag('select', project.container)) {

//* 1) check current selected values:

	const	sectionName   = selectBox.getAttribute('data-section');
	const	listName      = selectBox.name;
	const	selectedValue = selectBox.value || '';

	let	hide = false;

//* 2) hide irrelevant options:

		if (updatedValues && updatedValues !== true) {
		let	fallbackValue = '';
		let	selectedValueHidden = false;
		let	allHidden = true;

			for (const option of selectBox.options) {

			const	optionName = option.value || '';
			const	hide = !isSelectedOptionRelevant(project, updatedValues, sectionName, listName, optionName);

				if (hide) {
					if (optionName === selectedValue) {
						selectedValueHidden = true;
					}
				} else {
					if (
						optionName.length > 0
					&&	fallbackValue.length === 0
					) {
						fallbackValue = optionName;
					}
				}
				if (!hide && optionName) {
					allHidden = false;
				}
				if (!option.hidden === hide) {
					option.hidden = option.disabled = hide;
				}
			}

			hide = (allHidden ? 'none' : '');

			selectValue(selectBox, (
				!hide && selectedValueHidden
				? fallbackValue
				: selectedValue
			));

		const	container = getThisOrParentByClass(selectBox, regClassOption) || selectBox.parentNode;
		const	style = container.style;

			if (style.display != hide) {
				style.display = hide;
			}

			selectBox.hidden = allHidden;
		}

//* 3) get new values after update:

	const	section = getOrInitChild(values, sectionName);
	const	newSelectedValue = selectBox.value;

		section[listName] = (
			!hide
		&&	trim(listName).length > 0
		&&	trim(newSelectedValue).length > 0
			? newSelectedValue
			: ''
		);
	}

	setRenderRootByValues(project, null);

	return (
		updatedValues
		? values
		: getUpdatedMenuValues(project, values)
	);
}

function getOrCreateReusableHeap(project) {
let	buffer = project.renderingBuffer;

	if (!buffer) {
	const	realSize = project.width * project.height * 4 * 3;	//* <- 2 RGBA pixel buffers + 1 Alpha mask (as RGBA too for convenience)
	const	paddedSize = nextValidHeapSize(realSize);

		buffer = project.renderingBuffer = new ArrayBuffer(paddedSize);
	}

	return new Uint8Array(buffer);
}

function drawImageOrColor(project, ctx, img, blendMode, opacity, mask) {
	if (!ctx || !img) {
		return null;
	}

	if (typeof opacity === 'undefined') opacity = 1;
	if (typeof blendMode === 'undefined') blendMode = BLEND_MODE_NORMAL;

const	canvas = ctx.canvas;

	if (canvas && opacity > 0) {
	const	x = orz(img.left);
	const	y = orz(img.top);
	const	w = canvas.width;
	const	h = canvas.height;

		function drawImageOrColorInside(img) {
			if (
				img.join
			||	img.split
			) {
				ctx.fillStyle = getColorTextFromArray(img);
				ctx.fillRect(0,0, w,h);
			} else {
				ctx.drawImage(img, x,y);
			}
		}

		function tryBlendingEmulation(blendMode) {

			function tryEmulation(callback) {
			let	logLabelWrap, logLabel, testPrefix;

				if (TESTING_RENDER) {
					console.log('blendMode:', [blendMode, 'opacity:', opacity, mask ? 'callback with mask' : 'callback']);

					logLabelWrap = blendMode + ': ' + project.rendering.nestedLayers.map((layer) => layer.name).join(' / ');
					console.time(logLabelWrap);
					if (USE_CONSOLE_LOG_GROUPING) console.group(logLabelWrap);

					logLabel = blendMode + ': loading image data';
					console.time(logLabel);
				}

//* get pixels of layer below (B):

				ctx.globalAlpha = 1;
				ctx.globalCompositeOperation = BLEND_MODE_NORMAL;

				if (TESTING_RENDER) {
					testPrefix = 'tryBlendingEmulation: ' + blendMode + ', layer ';
					addDebugImage(project, canvas, testPrefix + 'below at ' + (ctx.globalAlpha * 100) + '%', 'yellow');
				}

			const	dataBelow = ctx.getImageData(0,0, w,h);
			const	rgbaBelow = dataBelow.data;

//* get pixels of layer above (A):

				ctx.clearRect(0,0, w,h);
				ctx.globalAlpha = (isTransition ? 1 : opacity);

				drawImageOrColorInside(img);

				if (TESTING_RENDER) addDebugImage(project, canvas, testPrefix + 'above at ' + (ctx.globalAlpha * 100) + '%', 'orange');

				ctx.globalAlpha = 1;

			const	dataAbove = ctx.getImageData(0,0, w,h);
			const	rgbaAbove = dataAbove.data;

//* get pixels of transition mask (M):

			let	rgbaMask;

				if (isTransition) {
					ctx.clearRect(0,0, w,h);
					ctx.globalAlpha = opacity;

					drawImageOrColorInside(mask || 'white');

					if (TESTING_RENDER) addDebugImage(project, canvas, testPrefix + 'mask at ' + (ctx.globalAlpha * 100) + '%', 'brown');

					ctx.globalAlpha = 1;

				const	maskData = ctx.getImageData(0,0, w,h);
					rgbaMask = maskData.data;
				}

//* compute resulting pixels linearly into dataAbove, and save result back onto canvas:

				if (TESTING_RENDER) {
					console.timeEnd(logLabel);

					logLabel = blendMode + ': running calculation';
					console.time(logLabel);
				}

			const	isDone = callback(rgbaAbove, rgbaBelow, rgbaMask);

				if (TESTING_RENDER) {
					console.timeEnd(logLabel);

					logLabel = blendMode + ': saving result to canvas';
					console.time(logLabel);
				}

				ctx.putImageData(isDone ? dataAbove : dataBelow, 0,0);

				if (TESTING_RENDER) {
					console.timeEnd(logLabel);

					if (USE_CONSOLE_LOG_GROUPING) console.groupEnd(logLabelWrap);
					console.timeEnd(logLabelWrap);
				}

				return isDone;
			}

			function usingAsmJS(rgbaAbove, rgbaBelow, rgbaMask) {
				try {
				const	arrayLength = rgbaAbove.length;
				const	uint8array = getOrCreateReusableHeap(project);
				const	env = null;
				const	heap = uint8array.buffer;
				const	compute = CompositionModule(window, env, heap);

					uint8array.set(rgbaBelow, 0);
					uint8array.set(rgbaAbove, arrayLength);

					if (rgbaMask) {
						uint8array.set(rgbaMask, arrayLength << 1);
					}

					compute[funcName](arrayLength);
					rgbaAbove.set(uint8array.slice(0, arrayLength));

					return true;

				} catch (error) {
					logError(error, arguments);
				}
			}

//* try computing in asm.js:

		const	funcName = blendMode.replace(/\W+/g, '_').toLowerCase();

			if (
				CompositionModule
			&&	CompositionFuncList
			&&	CompositionFuncList.includes(funcName)
			&&	tryEmulation(usingAsmJS)
			) {
				return true;
			}
		}

		ctx.globalCompositeOperation = blendMode;

	const	ctxBlendMode = ctx.globalCompositeOperation;
	const	isTransition = !!(mask || blendMode === BLEND_MODE_TRANSIT);

//* use native JS blending if available, or emulation fails/unavailable:

		if (
			ctxBlendMode === blendMode
		||	!tryBlendingEmulation(blendMode)
		) {
			if (TESTING && ctxBlendMode !== blendMode) console.error('blendMode:', [blendMode, 'fallback:', ctxBlendMode]);

			ctx.globalAlpha = opacity;

			drawImageOrColorInside(img);
		}

		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = BLEND_MODE_NORMAL;
	}

	return canvas;
}

function getPaddedImageData(referenceImageData, method, threshold, dimensions) {

	function addPadding(referenceImageData, dimensions) {

		function addRoundPadding(r) {
		const	paddingRadius = Math.abs(orz(r));
		const	pixelsAround = Math.ceil(paddingRadius);
		const	startDistance = (isMethodMin ? -Infinity : +Infinity);

			for (let resultY = h; resultY--;) next_result_pixel:
			for (let resultX = w; resultX--;) {

			const	resultByteIndex = getAlphaDataIndex(resultX, resultY, w);
			let	resultDistance = startDistance;

				look_around:
				for (let referenceY, dy = -pixelsAround; dy <= pixelsAround; ++dy) if ((referenceY = resultY + dy) >= 0 && referenceY < h) next_pixel_around:
				for (let referenceX, dx = -pixelsAround; dx <= pixelsAround; ++dx) if ((referenceX = resultX + dx) >= 0 && referenceX < w) {

				const	referenceAlpha = referencePixels[getAlphaDataIndex(referenceX, referenceY, w)];

					if (referenceAlpha <= threshold) {
						continue next_pixel_around;
					}

				const	referenceDistance = getDistance(dx, dy) + 1 - referenceAlpha/MAX_CHANNEL_VALUE;

					if (isMethodMin) {
						if (referenceDistance < paddingRadius) {
							if (resultDistance < referenceDistance) {
								resultDistance = referenceDistance;
							}
						} else {
							resultPixels[resultByteIndex] = MIN_CHANNEL_VALUE;
							continue next_result_pixel;
						}
					} else {
						if (referenceDistance > paddingRadius) {
							if (resultDistance > referenceDistance) {
								resultDistance = referenceDistance;
							}
						} else {
							resultPixels[resultByteIndex] = MAX_CHANNEL_VALUE;
							continue next_result_pixel;
						}
					}
				}

			const	resultDistanceFloor = Math.floor(resultDistance);

				resultPixels[resultByteIndex] = (
					resultDistanceFloor > paddingRadius
					? MIN_CHANNEL_VALUE
					: (MAX_CHANNEL_VALUE * (1 + resultDistanceFloor - resultDistance))
				);
			}
		}

		function addBoxPadding(x,y) {
		const	pixelsAroundX = Math.ceil(Math.abs(orz(x)));
		const	pixelsAroundY = Math.ceil(Math.abs(orz(y)));
		const	startAlpha = (isMethodMin ? MAX_CHANNEL_VALUE : MIN_CHANNEL_VALUE);

			for (let resultY = h; resultY--;) next_result_pixel:
			for (let resultX = w; resultX--;) {

			const	resultByteIndex = getAlphaDataIndex(resultX, resultY, w);
			let	resultAlpha = startAlpha;

				look_around:
				for (let referenceY, dy = -pixelsAroundY; dy <= pixelsAroundY; ++dy) if ((referenceY = resultY + dy) >= 0 && referenceY < h) next_pixel_around:
				for (let referenceX, dx = -pixelsAroundX; dx <= pixelsAroundX; ++dx) if ((referenceX = resultX + dx) >= 0 && referenceX < w) {

				const	referenceAlpha = referencePixels[getAlphaDataIndex(referenceX, referenceY, w)];

					if (referenceAlpha <= threshold) {
						continue next_pixel_around;
					}

					if (isMethodMin) {
						if (resultAlpha > referenceAlpha) {
							resultAlpha = referenceAlpha;
						}

						if (resultAlpha === MIN_CHANNEL_VALUE) {
							break look_around;
						}
					} else {
						if (resultAlpha < referenceAlpha) {
							resultAlpha = referenceAlpha;
						}

						if (resultAlpha === MAX_CHANNEL_VALUE) {
							break look_around;
						}
					}
				}

				resultPixels[resultByteIndex] = resultAlpha;
			}
		}

	const	resultImageData = new ImageData(w,h);
	const	resultPixels = resultImageData.data;
	const	referencePixels = referenceImageData.data;

		(
			dimensions.length > 1
			? addBoxPadding
			: addRoundPadding
		) (...dimensions);

		return resultImageData;
	}

	function subtractPadding(referenceImageData, dimensions) {
		return getImageDataInverted(
			addPadding(
				getImageDataInverted(referenceImageData)
			,	dimensions
			)
		);
	}

	if (!referenceImageData) {
		return null;
	}

const	w = referenceImageData.width;
const	h = referenceImageData.height;
const	isMethodMin = (method === 'min');
const	[ paddingX, paddingY ] = dimensions;

	if (dimensions.length > 1) {
		if ((paddingX < 0) !== (paddingY < 0)) {
			if (paddingX < 0) {
				return addPadding(subtractPadding(referenceImageData, [paddingX, 0]), [0, paddingY]);
			} else {
				return addPadding(subtractPadding(referenceImageData, [0, paddingY]), [paddingX, 0]);
			}
		}
	}

	if (paddingX < 0) {
		return subtractPadding(referenceImageData, dimensions);
	} else {
		return addPadding(referenceImageData, dimensions);
	}
}

function padCanvas(ctx, padding) {

	function addPaddingByDimensions(...dimensions) {
		dimensions = dimensions.filter(
			(dimension) => isNonNullObject(dimension)
		);

	const	isHollow = dimensions.every(
			(dimension) => (typeof dimension.in !== 'undefined')
		);

	const	resultImageData = getPaddedImageData(
			referenceImageData
		,	method
		,	threshold
		,	dimensions.map((dimension) => dimension.out)
		);

		ctx.putImageData(resultImageData, 0,0);

		if (isHollow) {
		const	cutImageData = getPaddedImageData(
				referenceImageData
			,	method
			,	threshold
			,	dimensions.map((dimension) => dimension.in)
			);

			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = BLEND_MODE_CUT;

			ctx.drawImage(getCtxFromImageData(cutImageData).canvas, 0,0);

			ctx.globalCompositeOperation = BLEND_MODE_NORMAL;
		}
	}

	if (
		!isNonNullObject(ctx)
	||	!isNonNullObject(padding)
	) {
		return;
	}

const	{ method, dimensions } = padding;

	if (
		!method
	||	!dimensions
	) {
		return;
	}

const	threshold = Math.abs(orz(padding.threshold));
const	isBox = ('x' in dimensions);

	if (isCanvasElement(ctx)) {
		ctx = ctx.getContext('2d');
	}

const	w = ctx.canvas.width;
const	h = ctx.canvas.height;
const	referenceImageData = ctx.getImageData(0,0, w,h);

	if (isBox) {
		addPaddingByDimensions(dimensions.x, dimensions.y)
	} else {
		addPaddingByDimensions(dimensions.radius)
	}
}

function makeCanvasOpaqueAndGetItsMask(project, ctx) {
	if (project.rendering) {
		++project.rendering.layersBatchCount;
	}

const	canvas = cre('canvas');
const	w = canvas.width  = ctx.canvas.width;
const	h = canvas.height = ctx.canvas.height;
const	img = ctx.getImageData(0,0, w,h);

	canvas.getContext('2d').putImageData(img, 0,0);

	for (
	let	data = img.data
	,	index = data.length - 1;
		index >= 0;
		index -= 4
	) {
		data[index] = 255;
	}

	ctx.putImageData(img, 0,0);

	return canvas;
}

async function addDebugImage(project, canvas, comment, highLightColor) {
	if (
		TESTING_RENDER
	&&	canvas
	&&	canvas.toDataURL
	) {
	const	img = cre('img', project.renderContainer);

		if (project) {
		const	PR = project.rendering || {};
		const	layers = PR.nestedLayers;
		const	layer = layers[layers.length - 1];

			img.alt = img.title = [
				'render name: ' + PR.fileName
			,	'render nesting level: ' + layers.length
			,	'render nesting path: ' + layers.map((v) => v.name).join(' / ')
			,	'layer nesting path: ' + getLayerPathText(layer)
			,	'layer name: ' + (layer ? layer.nameOriginal : layer)
			,	'comment: ' + comment
			].join(TITLE_LINE_BREAK);
		} else {
			img.alt = img.title = comment;
		}

		if (highLightColor) {
			img.style.borderColor = highLightColor;
			img.style.boxShadow = '3px 3px ' + highLightColor;
		}

		if (! await getImagePromiseFromCanvasToBlob(canvas, project, 0, 0, img)) {
			img.src = canvas.toDataURL();
		}
	}
}

async function setMergedImage(project, img, layer) {
	if (CACHE_UNALTERABLE_FOLDERS_MERGED) {
		if (CACHE_UNALTERABLE_IMAGES_TRIMMED) {
			img = getCroppedCanvasCopy(project, img) || img;
		}

		if (img = await getImagePromiseFromCanvasToBlob(img, project)) {
			project.mergedImages.push(layer.mergedImage = img);

			if (TESTING > 1) console.log('Set merged branch image:', layer);

			if (TESTING > 2 || TESTING_RENDER) {
				img.onclick = del;
				img.title = [
					getLayerPathText(layer)
				,	'merged branch image: ' + img.width + 'x' + img.height + ', click to remove'
				].join(TITLE_LINE_BREAK);

				if (typeof img.top !== 'undefined') {
					img.title = [
						img.title
					,	'x = ' + img.left
					,	'y = ' + img.top
					].join(TITLE_LINE_BREAK);
				}

				document.body.append(img);
			}
		}

		return img;
	}
}

function getCroppedCanvasCopy(project, img) {
const	crop = getAutoCropArea(img);

	if (TESTING > 1) console.log('Crop area:', crop);

	if (
		isNonNullObject(crop)
	&&	crop.width > 0
	&&	crop.height > 0
	&&	(
			crop.width < img.width
		||	crop.height < img.height
		)
	) {
	const	canvas = getNewCanvasForImg(project, crop);
	const	ctx = canvas.getContext('2d');
		ctx.drawImage(img, -crop.left, -crop.top);

		if (TESTING > 1) console.log('Cropped image on canvas:', canvas);

		if (TESTING > 2 || TESTING_RENDER) {
			canvas.onclick = del;
			canvas.title = 'cropped image: ' + canvas.width + 'x' + canvas.height + ', click to remove';

			if (typeof canvas.top !== 'undefined') {
				canvas.title = [
					canvas.title
				,	'x = ' + canvas.left
				,	'y = ' + canvas.top
				].join(TITLE_LINE_BREAK);
			}

			document.body.append(canvas);
		}

		return canvas;
	}
}

function getNewCanvasForProject(project) {
	if (project.rendering) {
		++project.rendering.layersBatchCount;
	}

const	canvas = cre('canvas');

	canvas.width  = project.width;
	canvas.height = project.height;

	return canvas;
}

function getNewCanvasForImg(project, img) {
	if (project.rendering) {
		++project.rendering.layersBatchCount;
	}

const	canvas = cre('canvas');
const	size = getImageContentSize(img);

	canvas.top    = orz(img.top);
	canvas.left   = orz(img.left);
	canvas.width  = orz(size.width)  || project.width;
	canvas.height = orz(size.height) || project.height;

	return canvas;
}

function getCanvasCopy(project, img) {
	if (!isNonNullObject(img)) {
		return null;
	}

const	canvas = getNewCanvasForImg(project, img);
const	ctx = canvas.getContext('2d');

	if (isCanvasElement(img)) {
		ctx.putImageData(img.getContext('2d').getImageData(0,0, canvas.width, canvas.height), 0,0);
	} else {
		ctx.drawImage(img, 0,0);
	}

	return canvas;
}

function getCanvasFlipped(project, img, flipSide, flags) {
	if (!isNonNullObject(img)) {
		return null;
	}

	if (!isNonNullObject(flags)) {
		flags = {};
	}

	if (!flipSide) {
		return (
			flags.isCopyNeeded
			? getCanvasCopy(project, img)
			: img
		);
	}

const	canvas = getNewCanvasForImg(project, img);
const	ctx = canvas.getContext('2d');

	ctx.save();

//* flip: https://stackoverflow.com/a/3129152

	if (flipSide & FLAG_FLIP_HORIZONTAL) {
		ctx.translate(canvas.width, 0);
		ctx.scale(-1, 1);
	}

	if (flipSide & FLAG_FLIP_VERTICAL) {
		ctx.translate(0, canvas.height);
		ctx.scale(1, -1);
	}

	ctx.drawImage(img, 0,0);

//* restore: https://stackoverflow.com/a/42856420

	ctx.restore();

	return canvas;
}

function getCanvasFilledOutsideOfImage(project, imgOrLayer, fillColor) {
	if (!isNonNullObject(imgOrLayer)) {
		return null;
	}

const	imgElement = getPropByAnyOfNamesChain(imgOrLayer, 'img');

	if (
		!isImageElement(imgElement)
	&&	!isCanvasElement(imgElement)
	) {
		return null;
	}

const	size = getImageContentSize(imgElement);

	if (
		!fillColor
	||	(
			!imgOrLayer.left && !imgElement.left
		&&	!imgOrLayer.top  && !imgElement.top
		&&	(!size.width  || size.width  === project.width)
		&&	(!size.height || size.height === project.height)
		)
	) {
		return imgElement;
	}

const	canvas = getNewCanvasForProject(project);
const	ctx = canvas.getContext('2d');
const	flatColorData = ctx.createImageData(canvas.width, canvas.height);

	fillColor = Math.max(0, Math.min(255, orz(fillColor)));

	flatColorData.data.fill(fillColor);
	ctx.putImageData(flatColorData, 0,0);

const	w = orz(getPropFromAnySource('width',  imgOrLayer, size, project));
const	h = orz(getPropFromAnySource('height', imgOrLayer, size, project));
const	x = orz(getPropFromAnySource('left',   imgOrLayer, imgElement));
const	y = orz(getPropFromAnySource('top',    imgOrLayer, imgElement));

	ctx.clearRect(x,y, w,h);
	ctx.drawImage(imgElement, x,y);

	return canvas;
}

function getCanvasBlended(project, imgBelow, imgAbove, mode, maskOpacity) {
const	canvas = getNewCanvasForProject(project);
const	ctx = canvas.getContext('2d');

	if (imgBelow) drawImageOrColor(project, ctx, imgBelow);
	if (imgAbove) drawImageOrColor(project, ctx, imgAbove, mode || BLEND_MODE_CLIP, maskOpacity);

	return canvas;
}

function getCanvasColored(project, values, listName, img) {
let	canvas, color;
const	selectedColors = project.rendering.colors;

	if (selectedColors) {
		if (listName in selectedColors) {
			color = selectedColors[listName];
		} else {
		const	optionalColors = getSelectedOptionValue(project, values, 'colors', listName);

			if (optionalColors) {
				for (const layer of optionalColors)
				if (
					layer.isColor
				&&	getLayerPathVisibilityByValues(project, layer, values, listName)
				) {
					color = selectedColors[listName] = getPropByAnyOfNamesChain(layer, 'color', 'img', 'layer');

					break;
				}
			}
		}
	}

	if (color) {
		canvas = getCanvasBlended(
			project
		,	(img || color)
		,	(img ? color : null)
		);
	}

	return canvas || img;
}

function getProjectOptionValue(project, sectionName, listName, ...optionName) {
	return getPropByNameChain(project, 'options', sectionName, listName, 'items', ...optionName);
}

function getProjectOptionParam(project, sectionName, listName, ...optionName) {
	return getPropByNameChain(project, 'options', sectionName, listName, 'params', ...optionName);
}

function getSelectedOptionValue(project, values, sectionName, listName) {
const	selectedName = getPropByNameChain(values, sectionName, listName);
const	selectedValue = getProjectOptionValue(project, sectionName, listName, selectedName);

	return selectedValue;
}

function getSelectedMenuValue(project, sectionName, listName, defaultValue) {
const	selectBox = getAllByTag('select', project.container).find(
		(selectBox) => (
			sectionName === selectBox.getAttribute('data-section')
		&&	listName === selectBox.name
		)
	);

	if (selectBox) {
	const	selectedValue = selectBox.value;

		if (isNotEmptyString(selectedValue)) {
			return selectedValue;
		}
	}

	return defaultValue;
}

function isLayerVisibleByCopyPaste(project, layer, values, listName) {

	if (layer.isCopySource) {
	const	aliases = layer.params.copypaste.copy;

		if (
			isArray(aliases)
		&&	aliases.some(
				(alias) => (
					getPropByNameChain(project, 'layersCopyPasteTargetsByAlias', alias)
				||	DUMMY_EMPTY_ARRAY
				).some(
					(targetLayer) => getLayerPathVisibilityByValues(project, targetLayer, values, listName)
				)
			)
		) {
			return true;
		}
	}

	return false;
}

function getLayerPathVisibilityByValues(project, layer, values, listName) {
	if (TESTING && !layer.params) {
		console.error('No params:', [project, layer, values, listName]);
	}

const	renderingRootLayer = project.renderingRootLayer;

	if (layer.params.check_order === 'up') {
	let	layers = getLayerVisibilityChain(layer);

		if (renderingRootLayer) {
		const	checkFromIndex = layers.indexOf(renderingRootLayer) + 1;

			if (checkFromIndex) {
				layers = layers.slice(checkFromIndex);

	//* TODO? or maybe remove this 'up' branch.

			// } else {
				// return false;
			}
		}

	//* up? not really:

		if (layers.slice().reverse().some(
			(layer) => isLayerVisibleByCopyPaste(project, layer, values, listName)
		)) {
			return true;
		}

		if (layers.some(
			(layer) => !getLayerVisibilityByValues(project, layer, values, listName)
		)) {
			return false;
		}
	} else {
		do {
			if (layer === renderingRootLayer) {
				return true;
			}

			if (!getLayerVisibilityByValues(project, layer, values, listName)) {
				return false;
			}

			if (isLayerVisibleByCopyPaste(project, layer, values, listName)) {
				return true;
			}
		} while (layer = getLayerVisibilityParent(layer));

	//* TODO: make this work with [no-render] colors and logic-only empty options.

		// if (renderingRootLayer) {
			// return false;
		// }
	}

	return true;
}

function getLayerVisibilityByValues(project, layer, values, listName) {

	function skipByFunc(layer, callback, isNot) {
		return (
			layer.names
			? (
				isNot
				? layer.names.some ((name) => callback(name, isNot))
				: layer.names.every((name) => callback(name, isNot))
			)
			: callback(layer.name, isNot)
		);
	}

	function skipByAnyName(listName) {
	const	selectedName = getPropByNameChain(values, layer.type, listName) || '';

		return (!layer.params.not === !selectedName);
	}

	function skipBySpecificName(optionName, isNot) {

		function skipByListName(listName) {
		const	selectedName = getPropByNameChain(values, parent.type, listName) || '';

			return (optionName === selectedName) === isNot;
		}

		return skipByFunc(parent, skipByListName, isNot);
	}

	function getOpacityByAnyName() {
	let	maxOpacity = -1;
	let	unselectable = false;

		if (listName) {
		const	opacity = getSelectedOptionValue(project, values, 'opacities', listName);

			if (opacity === null) {
				unselectable = true;
			} else {
				maxOpacity = opacity;
			}
		} else
		for (const listName of layer.names) {
		const	opacity = getSelectedOptionValue(project, values, 'opacities', listName);

			if (opacity === null) {
				unselectable = true;
			} else {
				if (maxOpacity < opacity) maxOpacity = opacity;
				if (maxOpacity >= 1) break;
			}
		}

		return (
			maxOpacity < 0
			? (isVisible ? layer.opacity : 0)
			: (unselectable ? 1 : maxOpacity)
		);
	}

//* skip by explicit name or param:

	if (isLayerSkipped(layer)) {
		return 0;
	}

//* skip not selected parts:

const	isRenderingRoot = (layer === project.renderingRootLayer);
let	isVisible = !!(
		isRenderingRoot
	||	layer.isVisible
	||	layer.isVisibilityOptional
	||	layer.copyPastedTo
	||	layer.params.skip_render
	);

	if (
		isRenderingRoot
	||	layer.copyPastedTo
	) {
		return getOpacityByAnyName();
	}

	if (layer.isOnlyForOneSide) {
	const	selectedName = getPropBySameNameChain(values, 'side');

		if (layer.params.side !== selectedName) {
			return 0;
		} else {
			isVisible = true;
		}
	}

	if (layer.isOptionIfAny) {
		if (skipByFunc(layer, skipByAnyName)) {
			return 0;
		} else {
			isVisible = true;
		}
	}

const	parent = layer.optionParent;

	if (parent) {
	const	isNot = (!layer.params.not !== !parent.params.not);

		if (skipByFunc(layer, skipBySpecificName, isNot)) {
			return 0;
		} else {
			isVisible = true;
		}
	}

//* skip fully transparent:

	return getOpacityByAnyName();
}

async function getRenderByValues(project, values, nestedLayersBatch, renderParams) {

	async function renderOneLayer(layer) {

		async function onOneLayerDone() {
			PR.nestedLayers.pop();

			if (
				ADD_PAUSE_AT_INTERVALS
			&&	PR.lastPauseTime + PAUSE_WORK_INTERVAL < getTimeNow()
			) {
				updateProjectLoadedImagesCount(project);

				await pause(PAUSE_WORK_DURATION);

				PR.lastPauseTime = getTimeNow();
			}
		}

	const	PR = project.rendering;
		PR.nestedLayers.push(layer);
		PR.nestedLevelMax = Math.max(
			PR.nestedLevelMax
		,	PR.nestedLayers.length
		);

		if (TESTING > 9) console.log(
			'rendering nested layer at:'
		,	PR.nestedLayers.length
		,	PR.nestedLayers.map((v) => v.name).join(' / ')
		,	PR.nestedLayers
		);

	const	{ ignoreColors, skipCopyPaste, clippingGroupWIP } = renderParams;
	const	{ names, params } = layer;

	const	skipRecoloring = !!params.if_only;
	const	backward = (
			layer.isOrderedBySide
		&&	isBackSide
		);

	const	flipSide = orz(
			backward
			? layer.flipSide
			: 0
		);

	const	canSaveMergedImage = (
			!!renderParams.canSaveMergedImage
		&&	!skipCopyPaste
		&&	layer.isUnalterable
		);

	let	clippingGroupResult = false;
	let	clippingGroupLayers;

//* step over clipping group to render or skip at once:

		if (
			!clippingGroupWIP
		&&	!ignoreColors
		&&	(layer.parent !== layersToRenderOne)
		) {
			clippingGroupLayers = [];

		let	siblingIndex = indexToRender;
		let	siblingLayer;

			while (
				(siblingIndex-- > 0)
			&&	(siblingLayer = layersToRender[siblingIndex])
			&&	siblingLayer.isClipped
			&&	siblingLayer.clippingLayer
			) {
				clippingGroupLayers.push(siblingLayer);
			}

			if (clippingGroupLayers.length > 0) {
				indexToRender = siblingIndex + 1;

				clippingGroupLayers.reverse();
				clippingGroupLayers.push(layer);

				clippingGroupResult = true;
			}
		}

//* skip not visible, not selected, etc:

	let	opacity = 0;

		if (
			!isLayerRendered(layer)
		||	!(opacity = renderParams.opacity || getLayerVisibilityByValues(project, layer, values))
		) {
			return await onOneLayerDone();
		}

//* skip unrelated to alpha composition when getting mask for padding:

	let	blendMode = layer.blendMode;

		if (ignoreColors) {
			if (!regLayerBlendModeAlpha.test(blendMode)) {
				blendMode = BLEND_MODE_NORMAL;
			}

			if (
				layer.isClipped
			&&	layer.clippingLayer
			&&	blendMode === BLEND_MODE_NORMAL
			) {
				return await onOneLayerDone();
			}
		} else {
			if (
				clippingGroupWIP
			&&	layer === bottomLayer
			) {
				blendMode = BLEND_MODE_NORMAL;
			}
		}

//* start rendering:

	let	img, canvasCopy;

		if (
			!canvas
		&&	(canvas = renderParams.baseCanvas)
		) {
			ctx = canvas.getContext('2d');

			if (TESTING_RENDER) addDebugImage(project, canvas, 'renderParams.baseCanvas', 'green');
		}

//* render clipping group as separate batch:

		if (clippingGroupResult) {
			img = await getRenderByValues(
				project
			,	values
			,	clippingGroupLayers
			,	{
					ignoreColors
				,	skipCopyPaste
				,	'clippingGroupWIP' : true
				}
			);

			if (TESTING_RENDER) addDebugImage(project, img, 'clippingGroupResult: img = getRenderByValues', 'cyan');
		} else {

		let	layers = layer.layers || null;

//* append copypasted layers to subqueue:

		let	addCopyPaste = false;

			if (skipCopyPaste !== layer) {
				for (const pasteType of PARAM_KEYWORDS_PASTE) {

				const	aliasesToPaste = getPropByNameChain(params, 'copypaste', pasteType);

					if (isNonEmptyArray(aliasesToPaste)) {
						addCopyPaste = true;

						layers = (
							isArray(layers)
							? layers.slice()
							: [layer]
						);

					const	oldLayersCount = layers.length;

						for (const alias of aliasesToPaste) {
						const	linkedLayers = getPropByNameChain(project, 'layersCopyPasteSourcesByAlias', alias);

							if (isNonEmptyArray(linkedLayers))
							for (const linkedLayer of linkedLayers) {
								if (
									!linkedLayer.copyPastedTo
								&&	addToListIfNotYet(layers, linkedLayer)
								) {
									linkedLayer.copyPastedTo = layer;
								}
							}
						}

					const	addedLayersCount = layers.length - oldLayersCount;

//* put copypasted layers atop own content:

						if (
							oldLayersCount > 0
						&&	addedLayersCount > 0
						&&	!pasteType.includes('below')
						) {
							layers = (
								layers.slice(oldLayersCount)
							).concat(
								layers.slice(0, oldLayersCount)
							);
						}

						if (TESTING > 9) console.log(
							'layers after copypaste:', [
								layers,
								'was:', oldLayersCount,
								'added:', addedLayersCount,
								'total:', layers.length,
							]
						);
					}
				}
			}

			if (isArray(layers)) {

//* get a flat color fill, using the first non-empty value found in associated lists:

				if (
					!skipRecoloring
				&&	layer.isColorList
				) {
					names.find(
						(listName) => !!(
							img = getCanvasColored(project, values, listName)
						)
					);
				} else

//* get layer/folder/batch as flat image:

				if (layers.length > 0) {
					if (backward) {
						layers = layers.slice().reverse();
					}

//* passthrough mode:

//* if folder is to be recolored,
//* ignore passthrough and any color blending inside.

//* if nothing was rendered below,
//* ignore passthrough, render normally.

//* in trivial cases,
//* simply render the folder content in its parent's context.

//* in complicated cases, interpolate render state
//* between before and after trivial-case rendering
//* using mask x opacity as transition value map.

				const	isToRecolor = (
						ignoreColors
					||	names.some(
							(listName) => (
								listName in colors
							&&	colors[listName]
							)
						)
					);

					if (
						!isToRecolor
					&&	layer.isPassThrough
					) {
					const	isPassThroughAndClippingBase = (
							indexToRender > 0
						&&	layer.isVirtualFolder
						&&	layer === layersToRender[indexToRender - 1].clippingLayer
						);

						if (
							flipSide
						||	isPassThroughAndClippingBase	//* <- TODO: blending modes and non-virtual folders
						||	blendMode !== BLEND_MODE_NORMAL
						||	opacity != 1
						||	layer.mask
						||	layer.isMaskGenerated
						) {
							canvasCopy = getCanvasFlipped(project, canvas, flipSide, FLAG_RENDER_LAYER_COPY);
						} else {
							layersToRender = layersToRender.slice(0, indexToRender).concat(layers);
							indexToRender = layersToRender.length;

							return await onOneLayerDone();
						}
					}

//* render folder contents, isolated or based on result before passthrough:

					if (
						canSaveMergedImage
					&&	layer.mergedImage
					) {
						img = layer.mergedImage;
					} else {
						img = await getRenderByValues(
							project
						,	values
						,	layers
						,	{
								'ignoreColors' : (ignoreColors || isToRecolor)
							,	'baseCanvas' : canvasCopy
							,	'skipCopyPaste' : (addCopyPaste ? layer : false)
							,	'canSaveMergedImage' : !layer.isUnalterable
							}
						);

						if (
							canSaveMergedImage
						&&	img
						) {
							await setMergedImage(project, img, layer);
						}
					}

					if (TESTING_RENDER) addDebugImage(project, img, 'folder content result: img = getRenderByValues');
				}

				if (addCopyPaste) {
					for (const renderedLayer of layers) {
						if (renderedLayer.copyPastedTo === layer) {
							renderedLayer.copyPastedTo = null;
						}
					}
				}
			} else {

//* not a folder, not a stack of copypaste:

				img = layer.img || await getOrLoadImage(project, layer);
			}
		}

		if (img) {
		let	mask;

			if (clippingGroupResult) {
				opacity = 1;
			} else {

//* get mask of neighbour content, rendered before or after this layer:

				if (layer.isMaskGenerated) {
				const	paddings = (
						names
						.map(
							(listName) => getSelectedOptionValue(project, values, 'paddings', listName)
						)
						.filter(arrayFilterNonEmptyValues)
					);

					if (paddings.length > 0) {
						mask = await getRenderByValues(
							project
						,	values
						,	layersToRender.slice(0, indexToRender)	//* <- content after/above this layer
						,	FLAG_RENDER_IGNORE_COLORS			//* <- only care about alpha channel
						);

						if (TESTING_RENDER) addDebugImage(project, mask, 'mask = getRenderByValues');

//* apply padding to generated mask:

						if (mask) {
							for (const padding of paddings) {
								padCanvas(mask, padding);
							}

							if (TESTING_RENDER) addDebugImage(project, mask, 'padCanvas: mask');
						}
					}
				} else

//* get mask defined in the document:

				if (mask = layer.mask) {
				const	fillColor = orz(mask.defaultColor);
				const	maskImage = mask.img || await getOrLoadImage(project, mask);
					mask = getCanvasFilledOutsideOfImage(project, maskImage, fillColor);

					if (TESTING_RENDER) addDebugImage(project, mask, 'mask = getCanvasFilledOutsideOfImage: ' + fillColor);
				}

//* apply mask:

				if (mask) {
					if (canvasCopy) {
						if (flipSide) {
							mask = getCanvasFlipped(project, mask, flipSide);

							if (TESTING_RENDER) addDebugImage(project, mask, 'mask = getCanvasFlipped');
						}
					} else {
						img = getCanvasBlended(project, img, mask, BLEND_MODE_MASK);

						if (TESTING_RENDER) addDebugImage(project, img, 'img = getCanvasBlended: mask');

						clearCanvasBeforeGC(mask);
					}
				}

//* apply color:

				if (
					!skipRecoloring
				&&	!ignoreColors
				&&	!layer.isColorList	//* <- already got selected color fill
				) {
					for (const listName of names) {
						img = getCanvasColored(project, values, listName, img);
					}
				}

//* flip:

				if (flipSide) {
					img = getCanvasFlipped(project, img, flipSide);

					if (TESTING_RENDER) addDebugImage(project, img, 'img = getCanvasFlipped');
				}
			}

//* add content to current buffer canvas:

			if (!ctx) {
				canvas = getNewCanvasForProject(project);
				ctx = canvas.getContext('2d');
			}

			if (canvasCopy) {
				drawImageOrColor(project, ctx, img, BLEND_MODE_TRANSIT, opacity, mask);

				if (TESTING_RENDER) addDebugImage(project, canvas, [
					'drawImageOrColor: ' + BLEND_MODE_TRANSIT
				,	'opacity = ' + opacity
				,	'mask = ' + mask
				].join(TITLE_LINE_BREAK), 'red');

				clearCanvasBeforeGC(mask);
				clearCanvasBeforeGC(canvasCopy);
			} else {
				drawImageOrColor(project, ctx, img, blendMode, opacity);

				if (TESTING_RENDER) addDebugImage(project, canvas, 'drawImageOrColor: ' + blendMode);
			}

			++project.rendering.layersApplyCount;

//* store the mask of the clipping group:

			if (
				clippingGroupWIP
			&&	layer === bottomLayer
			) {
				clippingMask = makeCanvasOpaqueAndGetItsMask(project, ctx);

				if (TESTING_RENDER) addDebugImage(project, canvas, 'clippingMask = makeCanvasOpaqueAndGetItsMask');
			}

			clearCanvasBeforeGC(img);
		}

		return await onOneLayerDone();
	}

	if (
		!project
	||	!project.layers
	||	isStopRequestedAnywhere(project)
	) {
		return;
	}

	if (project.loading) {
		logTime('getRenderByValues - skipped while loading project.');

		return;
	}

	if (!isNonNullObject(renderParams)) {
		renderParams = {};
	}

let	layer, layersToRenderOne;

	if (project.rendering) {
		if (nestedLayersBatch) {
			++project.rendering.layersBatchCount;
		} else {
			logTime('getRenderByValues - skipped while rendering: no layers in sub-batch.');

			return;
		}
	} else {
		if (layer = setRenderRootByValues(project, values)) {
			layersToRenderOne = (getParentLayer(layer) || project).layers;

			if (!layersToRenderOne.includes(layer)) {
				logTime('getRenderByValues - skipped before starting: separate layer not found.');

				setRenderRootByValues(project, null);

				return;
			}
		}

	const	startTime = getTimeNow();

		project.rendering = {
			startTime
		,	'lastPauseTime' : startTime
		,	'fileName' : getFileNameByValues(project, values)
		,	'layersApplyCount' : 0
		,	'layersBatchCount' : 1
		,	'nestedLevelMax' : 0
		,	'nestedLayers' : []
		,	'colors' : {}
		};
	}

let	layersToRender = layersToRenderOne || nestedLayersBatch || project.layers;
let	indexToRender = layersToRender.length;
let	indexToStop = 0;

const	bottomLayer = layersToRender[indexToRender - 1];
const	isBackSide = (getPropBySameNameChain(values, 'side') === 'back');
const	colors = getPropByNameChain(values, 'colors') || {};

let	canvas, ctx, mask, clippingMask;

	if (
		!ADD_PAUSE_BEFORE_EACH_LAYER
	&&	ADD_PAUSE_BEFORE_EACH_FOLDER
	) {
		await pause(1);
	}

//* start rendering layer batch:

	if (layersToRenderOne) {
		indexToStop = layersToRenderOne.indexOf(layer);
		indexToRender = indexToStop + 1;
	}

	while (indexToRender-- > indexToStop) if (layer = layersToRender[indexToRender]) {

		if (ADD_PAUSE_BEFORE_EACH_LAYER) {
			await pause(1);
		}

		if (isStopRequestedAnywhere(project)) {
			canvas = ctx = null;

			break;
		}

		await renderOneLayer(layer);
	}

//* end of layer batch.

	if (canvas && ctx) {

//* apply stored mask to the blended clipping group content:

		if (mask = clippingMask) {
			drawImageOrColor(project, ctx, mask, BLEND_MODE_MASK);

			if (TESTING_RENDER) addDebugImage(project, canvas, 'drawImageOrColor: mask = clippingMask');

			clearCanvasBeforeGC(mask);
		}
	}

//* end of layer tree:

	if (!nestedLayersBatch) {
	const	PR = project.rendering;
	const	renderingTime = getTimeNow() - PR.startTime;
	const	renderName = PR.fileName;

		if (isStopRequestedAnywhere(project)) {
			canvas = ctx = null;

			logTime('getRenderByValues - stopped by request after ' + (renderingTime / 1000) + ' seconds spent.', renderName);
		} else
		if (canvas) {
			canvas.renderingTime = renderingTime;

			logTime(
				'"' + project.fileName + '" rendered in '
			+	[	PR.layersBatchCount + ' canvas elements'
				,	PR.layersApplyCount + ' blending steps'
				,	PR.nestedLevelMax + ' max nesting levels'
				,	(renderingTime / 1000) + ' seconds'
				,	'subtitle'
				].join(', ')
			,	renderName
			);
		} else {
			logTime('getRenderByValues - visible layers not found.', renderName);
		}

		updateProjectLoadedImagesCount(project);
		setRenderRootByValues(project, null);
		project.rendering = null;
	}

	return canvas;
}

function isOptionSingle(params) {
	return (
		params.single
	||	!(params.batched || params.batch)
	);
}

function isOptionOmitable(params) {
	return (
		params.omitable
	||	!(params.unomitable || params.no_single)
	);
}

function isOptionPrefixed(params) {
	return (
		params.prefixed
	||	!(params.unprefixed || params.no_prefix)
	);
}

function getFileNameByValues(project, values, flags) {

	function getProcessedSectionName(sectionName) {

		function getProcessedListName(listName) {
		const	params = getProjectOptionParam(project, sectionName, listName);

			if (
				params
			&&	params.skipInStorageKeys
			) {
				return;
			}

		let	optionName = section[listName];

			if (flags.isForStorageKey) {
				return listName + '=' + optionName;
			}

			if (!optionName.length) {
				return;
			}

			if (params) {
				if (params.skipInFileNames) {
					return;
				}

				if (
					FILE_NAME_OMIT_SINGLE_OPTIONS
				&&	flags.checkSelectedValue
				&&	isOptionOmitable(params)
				&&	isOptionSingle(params)
				) {
					return;
				}

				if (flags.skipDefaultPercent) {
					if (sectionName === 'zoom') {
					const	zoomPercentage = orz(optionName);

						if (
							zoomPercentage === 100
						||	zoomPercentage <= 0
						) {
							return;
						}
					}

					if (
						ZERO_PERCENT_EQUALS_EMPTY
					&&	NAME_PARTS_PERCENTAGES.includes(sectionName)
					&&	orz(optionName) === 0
					) {
						return;
					}
				}

				if (
					sectionName === 'separate'
				&&	listName !== 'naming'
				&&	listName !== 'group'
				&&	values.separate.naming === 'equal'
				) {
				const	optionItem = getProjectOptionValue(project, sectionName, listName, optionName);

					if (isNonNullObject(optionItem)) {
					const	newName = (
							optionItem.group
							? optionItem.group + '='
							: ''
						) + optionItem.layer.name;

						if (newName) {
							optionName = newName;
						}
					}
				}

				if (
					FILE_NAME_ADD_PARAM_KEY
				&&	isOptionPrefixed(params)
				) {
					return listName + '=' + optionName;
				}
			}

			return optionName;
		}

	const	section = values[sectionName];

		if (!section) {
			return;
		}

		return (
			Object
			.keys(section)
			.filter(arrayFilterNonEmptyValues)
			.sort()
			.map(getProcessedListName)
			.filter(arrayFilterNonEmptyValues)
			.map(getFormattedFileNamePart)
			.join(NAME_PARTS_SEPARATOR)
		);
	}

	if (!isNonNullObject(flags)) {
		flags = {};
	}

	if (!isNonNullObject(values)) {
		values = getUpdatedMenuValues(project);
	}

	return (
		NAME_PARTS_ORDER
		.map(getProcessedSectionName)
		.filter(arrayFilterNonEmptyValues)
		.join(NAME_PARTS_SEPARATOR)
	);
}

function getFileNameByValuesToSave(project, values, flags) {
	return (
		[
			project.baseName
		,	getFileNameByValues(
				project
			,	values
			,	flags || FLAG_FILENAME_TO_SAVE
			)
		]
		.filter(arrayFilterNonEmptyValues)
		.join(NAME_PARTS_SEPARATOR)
		.replace(regSanitizeFileName, '_')
	);
}

function getKeyForValueSet(project, values) {
	return getFileNameByValuesToSave(
		project
	,	values
	,	FLAG_FILENAME_AS_KEY
	);
}

async function getOrCreateRender(project, render) {
	if (!isNonNullObject(render)) {
		render = {};
	}

const	values    = render.values    || (render.values = getUpdatedMenuValues(project));
const	refValues = render.refValues || (
		render.refValues = getPatchedObject(
			values
		,	(
				isNotEmptyString(getPropBySameNameChain(values, 'autocrop'))
				? replaceJSONpartsForCropRef
				: replaceJSONpartsForZoomRef
			)
		)
	);
const	refName   = render.refName   || (render.refName   = getKeyForValueSet(project, refValues));
const	fileName  = render.fileName  || (render.fileName  = getKeyForValueSet(project, values));
const	img       = render.img       || (render.img       = await getOrCreateRenderedImg(project, render));

	if (img) {
		img.fileNameToSave =
		render.fileNameToSave = (
			getFileNameByValuesToSave(project, values)
			+ '.'
			+ (img.type || 'png')
		);

		img.alt =
		img.title = img.fileNameToSave + img.subtitle;
	}

	return render;
}

async function getOrCreateRenderedImg(project, render) {

	function getAndCacheRenderedImageElementPromise(canvas, fileName) {
		return getImagePromiseFromCanvasToBlob(canvas, project).then(
			(img) => {
				if (!isNonNullObject(img)) {
					return null;
				}

			const	msec = canvas.renderingTime;

				img.name = fileName + '.' + (img.type || 'png');
				img.subtitle = (
					TITLE_LINE_BREAK
				+	'('
				+		img.width + 'x' + img.height
				+		(
							typeof msec === 'undefined'
							? '' :
							', ' + getLocalizedText('render_took_time', msec / 1000)
						)
				+	')'
				);

				img.alt =
				img.title = img.name + img.subtitle;

				prerenders[fileName] = img;

				return img;
			}
		).catch(catchPromiseError);
	}

	if (!isNonNullObject(render)) {
		render = await getOrCreateRender(project);
	}

let	img = render.img;

	if (img) {
		return img;
	}

const	prerenders = getOrInitChild(project, 'renders');
const	fileName = render.fileName;

	if (fileName in prerenders) {
		return prerenders[fileName];
	}

//* let UI update before creating new image:

	await pause(1);

	if (isStopRequestedAnywhere(project)) {
		return;
	}

const	values = render.values;
const	refName = render.refName;

	img = prerenders[refName];

	if (!img) {
		if (fileName === refName) {
		const	canvas = await getRenderByValues(project, values);

			if (canvas) {
				img = await getAndCacheRenderedImageElementPromise(canvas, refName);
			} else
			if (isStopRequestedAnywhere(project)) {
				return;
			} else {
				prerenders[fileName] = null;
			}
		} else {
			render = { 'values' : render.refValues };
			render = await getOrCreateRender(project, render);
			img = render.img;
		}
	}

	if (isStopRequestedAnywhere(project)) {
		return;
	}

let	zoomPercentage;

	if (
		img
	&&	(zoomPercentage = orz(getPropBySameNameChain(values, 'zoom')))
	&&	zoomPercentage > 0
	&&	zoomPercentage !== 100
	) {
	const	zoomRatio = zoomPercentage / 100;
	const	canvas = cre('canvas');
	const	ctx = canvas.getContext('2d');
	const	w = canvas.width  = Math.max(1, Math.round(zoomRatio * project.width));
	const	h = canvas.height = Math.max(1, Math.round(zoomRatio * project.height));

		ctx.drawImage(img, 0,0, w,h);

		img = await getAndCacheRenderedImageElementPromise(canvas, fileName);
	}

let	autocrop, crop;

	if (
		img
	&&	isNotEmptyString(autocrop = getPropBySameNameChain(values, 'autocrop'))
	&&	isNonNullObject(crop = getAutoCropArea(img, autocrop))
	) {
		if (
			crop.width > 0
		&&	crop.height > 0
		) {
		const	cropValues = getPatchedObject(values, replaceJSONpartsForCropRef);
		const	cropRefName = getKeyForValueSet(project, cropValues);

		const	cropId = [
				'x=' + crop.left
			,	'y=' + crop.top
			,	'w=' + crop.width
			,	'h=' + crop.height
			].join(',');

			cropValues.autocrop = { 'autocrop' : cropId };

		const	cropName = getKeyForValueSet(project, cropValues);
		const	fullSize = getImageContentSize(img);

			if (cropName in prerenders) {
				img = prerenders[fileName] = prerenders[cropName];
			} else
			if (
				crop.width  < fullSize.width
			||	crop.height < fullSize.height
			) {
			const	canvas = cre('canvas');
			const	ctx = canvas.getContext('2d');
			const	w = canvas.width  = crop.width;
			const	h = canvas.height = crop.height;

				ctx.drawImage(img, -crop.left, -crop.top);

				img = prerenders[cropName] = await getAndCacheRenderedImageElementPromise(canvas, fileName);
			} else
			if (cropRefName in prerenders) {
				img = prerenders[fileName] = prerenders[cropName] = prerenders[cropRefName];
			} else {
				prerenders[fileName] = prerenders[cropName] = img;
			}
		} else {
			prerenders[fileName] = null;
		}
	}

	return img;
}

function getNewLineOptionLists(options) {
const	optionsForNewLines = {};

	for (const sectionName in options) {
	const	section = options[sectionName];

		for (const listName in section) {
		const	optionList = section[listName];

			if (getPropByNameChain(optionList, 'params', 'newline')) {
			const	listNames = getOrInitChild(optionsForNewLines, sectionName, Array);
				addToListIfNotYet(listNames, listName);
			}
		}
	}

	return optionsForNewLines;
}

function getNewLineSubcontainer(container, values, options) {
	if (!values || !options) {
		return container;
	}

	for (const sectionName in options) {
	const	section = options[sectionName];

		for (const listName of section) {
		const	optionName = getPropByNameChain(values, sectionName, listName);

			if (optionName !== null) {
			const	optionId = [
					sectionName
				,	listName
				,	optionName
				].join('\n');

			let	element = getChildByAttr(container, 'data-option-id', optionId);

				if (!element) {
					element = cre('div', container);
					element.setAttribute('data-option-id', optionId);
				}

				container = element;
			}
		}
	}

	return container;
}

async function renderAll(project, flags) {
	setWIPstate(true, project);

	if (!isNonNullObject(flags)) {
		flags = {};
	}

	if (
		!flags.saveToFile
	&&	!flags.saveToZipFile
	) {
		flags.showOnPage = true;
	}

	if (
		flags.saveToZipFile
	&&	! await loadLibOnDemandPromise('zip.js')
	) {
		return;
	}

	project.renderBatchCountStartTime = null;

const	logLabel = 'Render all: ' + project.fileName;
	console.time(logLabel);
	if (USE_CONSOLE_LOG_GROUPING) console.group(logLabel);

const	startTime = getTimeNow();
const	values = project.renderBatchSelectedOptions || (project.renderBatchSelectedOptions = getAllMenuValues(project, true));
const	valueSets = project.renderBatchSelectedSets || (project.renderBatchSelectedSets = await getAllValueSets(project, values));

	if (
		isNonNullObject(valueSets)
	&&	!isStopRequestedAnywhere(project)
	) {
		await renderBatch(project, flags, startTime, values, valueSets);
	}

	if (USE_CONSOLE_LOG_GROUPING) console.groupEnd(logLabel);
	console.timeEnd(logLabel);

	setWIPstate(false, project);
}

async function renderBatch(project, flags, startTime, values, valueSets) {
let	lastPauseTime = getTimeNow();

const	needWaitBetweenDL = (
		flags.saveToFile
	&&	!flags.saveToZipFile
	&&	!flags.asOneJoinedImage
	);

const	renderedImages = [];
const	optionsForNewLines = getNewLineOptionLists(project.options);
const	setsCountTotal = Object.keys(valueSets).length;

	await updateBatchCount(project, values, setsCountTotal);

let	setsCountWithoutPause = 0;
let	setsCount = 0;
let	totalTime = 0;
let	pauseAtIntervals = (ADD_PAUSE_AT_INTERVALS ? PAUSE_WORK_DURATION : 0);
let	batchContainer, subContainer;

	updateProjectOperationProgress(
		project
	,	'project_status_rendering_batch'
	,	setsCount
	,	setsCountTotal
	);

	if (flags.showOnPage) batchContainer = getEmptyRenderContainer(project); else
	if (flags.asOneJoinedImage) batchContainer = cre('div');

	logTime(
		'"' + project.fileName + '"'
	+	' started rendering ' + setsCountTotal
	+	' sets (listing took ' + (lastPauseTime - startTime)
	+	' ms)'
	);

	for (const fileName in valueSets) {

	const	startTime = getTimeNow();
	const	values = valueSets[fileName];
	const	render = await getOrCreateRender(
			project
		,	{ values, fileName }
		);

	let	img;

		if (batchContainer) {
			subContainer = getNewLineSubcontainer(batchContainer, values, optionsForNewLines);
		}

		if (flags.showOnPage) {
			img = await showImg(
				project
			,	render
			,	subContainer
			);
		}

		if (
			flags.asOneJoinedImage
		||	flags.saveToZipFile
		) {
			if (!img) {
				img = await getRenderedImg(project, render);
			}

			if (img) {
				if (
					addToListIfNotYet(renderedImages, img)
				&&	flags.asOneJoinedImage
				&&	!flags.showOnPage
				) {
					subContainer.appendChild(img);
				}
			}
		} else
		if (flags.saveToFile) {
			img = await saveImg(project, render);
		}

	const	endTime = getTimeNow();
		totalTime += (endTime - startTime);

		++setsCount;
		++setsCountWithoutPause;

//* Note: Chrome skips downloads if more than 10 in 1 second.
//* Source: https://stackoverflow.com/a/53841885

		if (
			(needWaitBetweenDL && (setsCountWithoutPause > 9))
		||	(ADD_PAUSE_AT_INTERVALS && (lastPauseTime + PAUSE_WORK_INTERVAL < endTime))
		) {
			updateProjectOperationProgress(
				project
			,	'project_status_rendering_batch'
			,	setsCount
			,	setsCountTotal
			);

			await pause(
				needWaitBetweenDL
				? Math.max(100 * setsCountWithoutPause, pauseAtIntervals)
				: pauseAtIntervals
			);

			lastPauseTime = getTimeNow();
			setsCountWithoutPause = 0;
		}

		if (isStopRequestedAnywhere(project)) {
			break;
		}
	}

	logTime(
		'"' + project.fileName + '"'
	+	' finished rendering ' + setsCount
	+	' / ' + setsCountTotal
	+	' sets, took ' + totalTime
	+	' ms total (excluding pauses)'
	);

	if (isStopRequestedAnywhere(project)) {
		return;
	}

	if (flags.saveToZipFile) {
	const	zipFile = new zip.fs.FS();
		zipFile.compressionLevel = 0;

	const	thisJob = { project, 'lastPauseTime' : getTimeNow() };
		pendingJobs.add(thisJob);

	let	imagesDone = 0;
	const	imagesTotal = renderedImages.length;
	const	onImageAddedProgress = getProgressUpdaterFunction(thisJob, 'project_status_saving_images');

		onImageAddedProgress(imagesDone, imagesTotal);

		for (const img of renderedImages) {
		let	content = img.src;

			if (
				content
			&&	isString(content)
			&&	hasPrefix(content, 'blob:')
			) {
				content = await getFilePromiseFromURL(content, 'blob');
			}

			if (TESTING > 9) console.log(
				'add image to zip file: ' + imagesDone + ' / ' + imagesTotal,
				[
					'URI:', img.src,
					'content type:', content.type || typeof content,
					'content size:', content.size || content.length,
				]
			);

			if (content) {
			const	imgFileName = img.fileNameToSave || img.name;
			const	methodName = (
					isBlob(content)
					? 'addBlob'
					:
					isString(content) && hasPrefix(content, 'data:')
					? 'addData64URI'
					: 'addText'
				);
			const	errors = [];
			let	lastError, duplicateIndex;

				for (
					duplicateIndex = 0;
					duplicateIndex < Number.MAX_SAFE_INTEGER;
					duplicateIndex++
				) {
					try {
						zipFile.root[methodName](
							duplicateIndex
							? imgFileName.replace(regFileExt, '(' + duplicateIndex + ')$&')
							: imgFileName
						,	content
						);

						break;

					} catch (error) {
						lastError = error;
					}

					if (ZIP_SKIP_DUPLICATE_FILENAMES) {
						break;
					} else {
						errors.push(lastError);
					}
				}

				if (errors.length > 0) {
					console.error('Error:', lastError, imgFileName, duplicateIndex, errors);
				} else
				if (lastError) {
					console.error('Error:', lastError, imgFileName, 'Skipped.');
				}

				onImageAddedProgress(++imagesDone, imagesTotal);
			}
		}

	const	isFileSaved = await new Promise(
			(resolve, reject) => zipFile.exportBlob(
				(blob) => {
					try {
						saveDL(blob, project.fileName + '_' + imagesDone, 'zip', 1);
						resolve(true);

					} catch (error) {
						reject(error);
					}
				}
			,	getProgressUpdaterFunction(thisJob, 'project_status_saving_file', true)
			,	reject
			)
		).catch(catchPromiseError);

		pendingJobs.delete(thisJob);
	}

	if (flags.asOneJoinedImage) {

		function getBatchCanvasSize(rootContainer) {
		let	x = 0;
		let	y = 0;
		let	width  = 0;
		let	height = 0;
		let	element = rootContainer.firstElementChild;

			while (element) {
				if (isImageElement(element)) {
				const	size = getImageContentSize(element);

					element.batchOffsetX = x;
					element.batchOffsetY = y;

					width  = Math.max(width,  x + size.width);
					height = Math.max(height, y + size.height);

					x += size.width + joinedPadding;
				} else {
				const	size = getBatchCanvasSize(element);

					element.batchOffsetX = x = 0;
					element.batchOffsetY = y = (height > 0 ? height + joinedPadding : 0);

					width  = Math.max(width,  x + size.width);
					height = Math.max(height, y + size.height);

					y = height + joinedPadding;
				}

				element = element.nextElementSibling;
			}

			return { width, height };
		}

		function getBatchOffsetXY(element) {
		let	x = joinedBorder;
		let	y = joinedBorder;

			while (element) {
				x += orz(element.batchOffsetX);
				y += orz(element.batchOffsetY);

				if (
					(element = element.parentNode)
				&&	element.getAttribute('data-option-id') === null
				) {
					break;
				}
			}

			return { x, y };
		}

		updateProjectOperationProgress(project, 'project_status_rendering_collage');

	const	startTime = getTimeNow();
	const	alignImages = getSelectedMenuValue(project, 'collage', 'align') || '';
	const	joinedBorder = Math.max(0, orz(getSelectedMenuValue(project, 'collage', 'border', DEFAULT_COLLAGE_PADDING_OUTSIDE)));
	const	joinedPadding = Math.max(0, orz(getSelectedMenuValue(project, 'collage', 'padding', DEFAULT_COLLAGE_PADDING_INSIDE)));
	const	size = getBatchCanvasSize(batchContainer);

	let	w = size.width;
	let	h = size.height;

		if (w > 0 && h > 0) {
			w += joinedBorder * 2;
			h += joinedBorder * 2;

		const	canvas = cre('canvas');
		const	ctx = canvas.getContext('2d');

			canvas.width = w;
			canvas.height = h;

			if (
				canvas.width !== w
			||	canvas.height !== h
			) {
				alert(getLocalizedText('error_canvas_size', w + 'x' + h));
			} else {
			let	backgroundFill = getSelectedMenuValue(project, 'collage', 'background');

				if (
					backgroundFill
				&&	backgroundFill !== 'transparent'
				&&	(backgroundFill = getColorTextFromArray(backgroundFill))
				&&	backgroundFill !== 'transparent'
				) {
					ctx.fillStyle = backgroundFill;
					ctx.fillRect(0,0, w,h);
				}

				for (const img of renderedImages) {
				const	pos = getBatchOffsetXY(img);

					ctx.drawImage(img, pos.x, pos.y);
				}

			const	img = await getImagePromiseFromCanvasToBlob(canvas, project).then(
					(img) => {
					const	endTime = getTimeNow();
						totalTime = (endTime - startTime);

						img.name = project.fileName + '.' + (img.type || 'png');
						img.alt =
						img.title = (
							img.name
						+	TITLE_LINE_BREAK
						+	'('
						+		w + 'x' + h + ', '
						+		getLocalizedText(
									'collage_took_time'
								,	totalTime / 1000
								,	renderedImages.length
								)
						+	')'
						);

						return img;
					}
				).catch(catchPromiseError);

				if (img) {
					if (flags.showOnPage) {
						makeElementFitOnClick(img);
						getEmptyRenderContainer(project).appendChild(img);
					}

					if (flags.saveToFile) {
						saveDL(
							img.src
						,	project.fileName + '_' + renderedImages.length
						,	img.type || 'png'
						,	1
						);
					}
				}
			}
		}
	}
}

function showAll(project) { renderAll(project); }
function saveAll(project) { renderAll(project, FLAG_SAVE_ALL); }
function saveZip(project) { renderAll(project, FLAG_SAVE_ZIP); }
function saveJoin(project) { renderAll(project, FLAG_SAVE_JOIN); }
function showJoin(project) { renderAll(project, FLAG_SHOW_JOIN); }

async function showImg(project, render, container) {
const	isSingleWIP = (render ? false : setWIPstate(true, project));
let	img;

	try {

//* cleanup before showing rendering steps:

	let	imgContainer;

		if (TESTING_RENDER) {
			imgContainer = container || getEmptyRenderContainer(project);
			img = await getOrCreateRenderedImg(project, render);
		} else {

//* prepare image before container cleanup to avoid flicker:

			img = await getOrCreateRenderedImg(project, render);
			imgContainer = container || getEmptyRenderContainer(project);
		}

		if (img) {
			makeElementFitOnClick(img);
			imgContainer.appendChild(img);

//* resize img to thumbnail on button:

			if (!container) {
				setProjectThumbnail(project, img);
			}
		}
	} catch (error) {
		logError(error, arguments);

		project.rendering = null;
	}

	if (isSingleWIP) setWIPstate(false, project);

	return img;
}

async function saveImg(project, render, fileName) {
const	isSingleWIP = (render ? false : setWIPstate(true, project));
let	img;

	try {
		render = await getOrCreateRender(project, render);
		img = render.img;

		if (img) {
			saveDL(
				img.src
			,	fileName || render.fileNameToSave || render.fileName
			,	img.type || 'png'
			);
		}
	} catch (error) {
		logError(error, arguments);

		project.rendering = null;
	}

	if (isSingleWIP) setWIPstate(false, project);

	return img;
}

async function getRenderedImg(project, render) {
const	isSingleWIP = (render ? false : setWIPstate(true, project));
let	img;

	try {
		img = await getOrCreateRenderedImg(project, render);
	} catch (error) {
		logError(error, arguments);

		project.rendering = null;
	}

	if (isSingleWIP) setWIPstate(false, project);

	return img;
}

function getEmptyRenderContainer(project) {
let	container = project.renderContainer;

	if (!container) {
		container = project.renderContainer = (
			getAllByClass('project-render', project.container)[0]
		||	getAllByClass('project-prerender', project.container)[0]
		);
	}

	if (container) {
		return delAllChildNodes(container);
	}
}

async function saveProject(project) {

	async function getLayersInOraFormat(layers) {

		async function addOneLayer(layer) {
			if (
				ADD_PAUSE_AT_INTERVALS
			&&	thisJob.lastPauseTime + PAUSE_WORK_INTERVAL < getTimeNow()
			) {
				updateProjectLoadedImagesCount(project);

				await pause(PAUSE_WORK_DURATION);

				thisJob.lastPauseTime = getTimeNow();
			}

			if (isStopRequestedAnywhere(thisJob, project)) {
				return null;
			}

		const	name = layer.nameOriginal || layer.name;
		let	x = orz(layer.left);
		let	y = orz(layer.top);
		let	oraNode, mask;

			if (layer.isLayerFolder) {
				oraNode = new ora.OraStack(name);
				oraNode.isolation = (layer.isPassThrough ? 'auto' : 'isolate');
			} else {
				oraNode = new ora.OraLayer(name, layer.width, layer.height);
			const	img = layer.imgFromColor || layer.img || await getOrLoadImage(project, layer);

				if (isImageElement(img)) {
					oraNode.image = img;

//* Reuse color-fill image kept from previous save:

					if (layer.imgFromColor) {
						oraNode.width  = Math.max(1, project.width);
						oraNode.height = Math.max(1, project.height);
						x = y = 0;
					}
				} else

//* Get color-fill image from color and keep for next save:

				if (img) {
				const	rgba = getRGBACutOrPadded(img, DEFAULT_COLOR_VALUE_ARRAY);
				let	width  = oraNode.width  = Math.max(1, project.width);
				let	height = oraNode.height = Math.max(1, project.height);
					x = y = 0;

					if (SAVE_COLOR_AS_ONE_PIXEL_IMAGE) {
						width = height = 1;
					}

				const	imgFromColor = await getImageElementFromData({
						'data' : rgba
					,	'width' : width
					,	'height' : height
					}, project, 1);

					if (TESTING > 9) console.log(
						'oraNode.image:', [
							'oraNode:', oraNode,
							'layer:', layer,
							'img:', img,
							'rgba:', rgba,
							'imgFromColor:', imgFromColor,
						]
					);

					if (isImageElement(imgFromColor)) {
						oraNode.image = layer.imgFromColor = imgFromColor;
					}
				}
			}

			oraNode.x = x;
			oraNode.y = y;
			oraNode.opacity = orzFloat(layer.opacity);
			oraNode.visibility = (layer.isVisible ? 'visible' : 'hidden');

		const	blendMode = layer.blendMode;
		const	oraBlendMode = getNormalizedBlendMode(
				blendMode
			,	BLEND_MODES_REMAP_TO_ORA
			,	BLEND_MODES_REPLACE_TO_ORA
			);

			if (
				blendMode !== BLEND_MODE_NORMAL
			&&	blendMode !== BLEND_MODE_PASS
			&&	blendMode !== BLEND_MODE_TRANSIT
			) {
				oraNode.composite = oraNode[
					blendMode.includes(BLEND_MODES_ALPHA_PREFIXES)
					? 'composite_alpha'
					: 'composite_color'
				] = oraBlendMode;
			}

			if (
				layer.isClipped
			||	blendMode === BLEND_MODE_CLIP
			) {
				oraNode.composite = oraNode.composite_alpha = getNormalizedBlendMode(
					BLEND_MODE_CLIP
				,	BLEND_MODES_REMAP_TO_ORA
				,	BLEND_MODES_REPLACE_TO_ORA
				);
			}

			if (
				!oraNode.composite_alpha
			||	!oraNode.composite_color
			||	oraNode.composite_alpha === oraNode.composite_color
			) {
				delete oraNode.composite_alpha;
				delete oraNode.composite_color;
			}

			if (mask = layer.mask) {
			const	maskImage = mask.img || await getOrLoadImage(project, mask);

				if (maskImage) {
					oraNode.mask = {
						'image' : maskImage
					,	'x' : orz(mask.left)
					,	'y' : orz(mask.top)
					};
				}
			}

			if (layer.isLayerFolder) {
			const	subLayers = await getLayersInOraFormat(layer.layers);

				if (null === subLayers) {
					return null;
				}

				oraNode.layers = subLayers || [];
			}

			oraLayers.push(oraNode);
		}

		if (!layers) {
			return [];
		}

	const	oraLayers = [];

		for (const layer of layers) {
		let	tempLayer = layer;

			if (layer.isVirtualFolder) {
			const	subLayer = layer.subLayer;
				tempLayer = {};

				for (const key in subLayer) {
					tempLayer[key] = (
						key in VIRTUAL_FOLDER_TAKEOVER_PROPERTIES
					&&	layer[key] !== VIRTUAL_FOLDER_TAKEOVER_PROPERTIES[key]
						? layer
						: subLayer
					)[key];
				}
			}

			if (null === await addOneLayer(tempLayer)) {
				return null;
			}
		}

		return oraLayers;
	}

	if (! await loadLibOnDemandPromise('ora.js')) {
		return;
	}

const	isSingleWIP = setWIPstate(true, project);
const	actionLabel = 'exporting to ORA file';
	logTime('"' + project.fileName + '" started ' + actionLabel);

const	thisJob = { project, 'lastPauseTime' : getTimeNow() };
	pendingJobs.add(thisJob);

let	oraLayers, img, randomOtherImg, failed, timeNow;

//* Use current selected options to create merged preview:

	try {
	const	render = await getOrCreateRender(
			project
		,	{
				'values' : getPatchedObject(
					getUpdatedMenuValues(project)
				,	replaceJSONpartsForZoomRef
				)
			}
		);

		if (isStopRequestedAnywhere(thisJob, project)) {
			oraLayers = null;
		} else {
			if (render) {
				img = render.img;
			}

//* If current selected options give empty result, pick another prerendered image:

			if (!img) {
			const	renders = project.renders;

				if (isNonNullObject(renders)) for (const key in renders)
				if (isImageElement(randomOtherImg = renders[key])) {
					img = randomOtherImg;

					break;
				}
			}

//* Convert layer tree to format used by the library:

			if (img) {
				oraLayers = await getLayersInOraFormat(project.layers);
			} else {
				failed = true;
			}
		}
	} catch (error) {

		failed = true;
		console.error(error);
	}

//* Pass prepared data to the library API and save the file content that it gives back:

	if (img && oraLayers) {
	const	oraFile = new ora.Ora(project.width, project.height);
		oraFile.lastModTime = project.lastModTime;
		oraFile.layers = oraLayers;
		oraFile.prerendered = img;

		if (
			project.width  > ORA_EXPORT_THUMBNAIL_SIZE
		||	project.height > ORA_EXPORT_THUMBNAIL_SIZE
		) {
			oraFile.thumbnail = await getImagePromiseFromCanvasToBlob(getResizedCanvasFromImg(img, ORA_EXPORT_THUMBNAIL_SIZE));
		} else {
			oraFile.thumbnail = img;
		}

		failed = ! await new Promise(
			(resolve, reject) => oraFile.save(
				(blob) => {
					try {
						saveDL(blob, project.baseName, 'ora', 1);
						resolve(true);

					} catch (error) {
						reject(error);
					}
				}
			,	reject
			,	{
					'imageFound' : getProgressUpdaterFunction(thisJob, 'project_status_saving_layers'),
					'imageDedup' : getProgressUpdaterFunction(thisJob, 'project_status_saving_images'),
					'imageMerge' : getProgressUpdaterFunction(thisJob, 'project_status_saving_render'),
					'zipExport'  : getProgressUpdaterFunction(thisJob, 'project_status_saving_file', true),
				}
			)
		).catch(catchPromiseError);
	}

//* Done, report, cleanup:

	pendingJobs.delete(thisJob);

	logTime('"' + project.fileName + '" ' + (
		failed
		? 'failed'
		: oraLayers === null
		? 'stopped'
		: 'finished'
	) + ' ' + actionLabel);

	if (isSingleWIP) setWIPstate(false, project);
}

function getProgressUpdaterFunction(context, key, isCountFormatted) {
const	getCountFormatted = (
		isCountFormatted
		? (value) => value.toLocaleString(LANG)
		: (value) => value
	);

	return (countDone, countTotal) => {
	const	timeNow = getTimeNow();

		if (context.lastPauseTime + PAUSE_WORK_INTERVAL < timeNow) {
			context.lastPauseTime = timeNow;

			updateProjectOperationProgress(
				context
			,	key
			,	getCountFormatted(countDone)
			,	getCountFormatted(countTotal)
			);
		}
	};
}

async function updateMenuAndShowImg(project) {
	if (
		!isNonNullObject(project)
	||	project.loading
	||	project.rendering
	||	project.isBatchWIP
	) {
		if (project.loading) logTime('updateMenuAndRender - skipped while loading project.');
		if (project.rendering) logTime('updateMenuAndRender - skipped while already rendering.');
		if (project.isBatchWIP) logTime('updateMenuAndRender - skipped while batch work is in progress.');

		return;
	}

	project.selectedMenuValues = null;

	return await showImg(project);
}

function updateFileNamingPanel(project, action) {

const	isActionClose = !action;
const	isActionReset = (!isActionClose && action.includes('reset'));
const	orderBox = project.fileNamingOrderBox;

	if (orderBox) {
		orderBox.hidden = isActionClose;
	}

	if (isActionReset) {

		//* TODO: reset order.

		updateFileNaming(project);
	} else {
		for (const name of PROJECT_NAMING_BUTTON_NAMES)
		for (const button of getAllByName(name, project.container)) {

			if (name.includes('change')) {
				button.disabled = !isActionClose;
			} else {
				button.hidden = isActionClose;
			}
		}
	}
}

function updateFileNaming(project, values) {

	function isOptionListRelevant(project, values, sectionName, listName) {

	const	value = getPropByNameChain(values, sectionName, listName);
	const	params = getProjectOptionParam(project, sectionName, listName);

		return (
			isOptionSingle(params)
			? (value && !isOptionOmitable(params))
			: true
		);
	}

const	orderBox = project.fileNamingOrderBox;

	if (orderBox) {
		if (!values) {
			values = getSelectedMenuValues(project);
		}

	const	sectionBoxes = getAllByClass('section', orderBox);

		for (const sectionBox of sectionBoxes) {
		const	sectionName = sectionBox.getAttribute('data-section');

			if (sectionName) {
			const	listNameBoxes = getAllByClass('list-name', sectionBox);

			let	isSectionRelevant = (
					listNameBoxes.length > 0
					? false
					: isOptionListRelevant(project, values, sectionName, sectionName)
				);

				for (const listNameBox of listNameBoxes) {
				const	listName = listNameBox.getAttribute('data-list-name');

					if (isOptionListRelevant(project, values, sectionName, listName)) {
						isSectionRelevant = true;

						toggleClass(listNameBox, 'relevant', 1);
					} else {
						toggleClass(listNameBox, 'relevant', -1);
					}
				}

				toggleClass(sectionBox, 'relevant', (isSectionRelevant ? 1 : -1));
			}
		}
	}

	updateSaveFileName(project);
}

function updateCheckBox(checkBox, params) {
	if (params || (params = checkBox.params)) {
	const	switchType = checkBox.getAttribute('data-switch-type');
	const	switchName = SWITCH_NAMES_BY_TYPE[switchType];
	const	targetState = !!checkBox.checked;

		params[switchName[0]] = !targetState;
		params[switchName[1]] = targetState;
	}
}

function updateMenuBatchCount(project, ...args) {
	if (ADD_BATCH_COUNT_ON_BUTTON) {
		for (const name of PROJECT_SAVE_ALL_BUTTON_NAMES)
		for (const button of getAllByName(name, project.container)) {

		const	label = button.lastElementChild || cre('span', button);
			label.className = 'count-label';
			label.textContent = args.join(' / ');
		}
	} else {
	let	label = project.renderBatchCountMenuLabel;

		if (!label) {
		const	labelClass = 'count-line';
			label = getAllByClass(labelClass, project.container)[0];

			if (!label) {
			let	container = getAllByName('show_all', project.container)[0] || project.container;
				container = getThisOrParentByClass(container, regClassSub);

				if (ADD_BATCH_COUNT_ON_NEW_LINE) {
					label = project.renderBatchCountMenuLabel = cre('header', container, container.lastElementChild);
					label.className = labelClass;
				} else {
					label = getAllByTag('header', container)[0];
					toggleClass(label, labelClass, 1);
				}
			}
		}

	let	textOverflow = false;

		if (!ADD_BATCH_COUNT_ON_NEW_LINE) {
		const	ref = label.nextElementSibling || label.previousElementSibling;

			if (ref && updateElementMaxWidth(label, ref)) {
				textOverflow = true;
			}
		}

	const	countText = (
			getLocalizedOrEmptyText(
				args.length > 1
				? 'batch_counting'
				: 'batch_count'
			,	...args
			)
		||	args.join(' / ')
		);

		label.title =
		label.textContent = (
			ADD_BATCH_COUNT_ON_NEW_LINE
		||	args.length > 1
			? countText
			: (
				getLocalizedText('batch_view_header')
			+	':\n'
			+	countText.toLowerCase()
			)
		);
	}
}

async function updateBatchCount(project, values, precounted) {
	if (!values) {
		values = getAllMenuValues(project, true);
	}

	if (!precounted) {
		project.renderBatchSelectedOptions = null;
		project.renderBatchSelectedSets = null;
	}

const	startTime = project.renderBatchCountStartTime = getTimeNow();
const	precounts = getOrInitChild(project, 'renderBatchCounts');
const	key = project.renderBatchCountSelectedKey = (
		(
			getAllByClass('batch-checkbox', project.container)
			.map((checkBox) => (checkBox.checked ? 1 : 0))
			.join('')
		)
	+	'_'
	+	getKeyForValueSet(project, values)
	);

let	count = (
		precounted
		? (precounts[key] = precounted)
		: precounts[key]
	);

	if (!count) {
		count = await getAllValueSetsCount(project, values, startTime);

//* if stopped by user or another count:

		if (typeof count === 'undefined') {

//* if another count was started, don't update anything here:

			if (startTime !== project.renderBatchCountStartTime) {
				return;
			}

//* otherwise report something, at least "over 9000" or just "too much":

		} else {
			if (
				MAX_BATCH_PRECOUNT
			&&	MAX_BATCH_PRECOUNT > 0
			&&	count > MAX_BATCH_PRECOUNT
			) {
				count = MAX_BATCH_PRECOUNT + '+';
			}

			precounts[key] = count;
		}
	}

	updateProjectOperationProgress(project, 'project_status_ready_options');
}

function setRenderRootByValues(project, values) {

const	optionItem = project.renderingRoot = getSelectedOptionValue(project, values, 'separate', 'separate');
const	layer = project.renderingRootLayer = (optionItem ? optionItem.layer : null);

	return layer;
}

function setWIPstate(isWIP, project) {
	isWIP = !!isWIP;

	if (project) {
		project.isStopRequested = false;
		project.isBatchWIP = isWIP;

		for (const tagName of PROJECT_CONTROL_TAGNAMES)
		for (const element of getAllByTag(tagName, project.container)) {

			if (!PROJECT_NAMING_BUTTON_NAMES.includes(element.name)) {

				element.disabled = (
					tagName === 'button'
				&&	element.name === 'stop'
					? !isWIP
					: isWIP
				);
			}
		}

		if (isWIP) {
			if (PRELOAD_LAYER_IMAGES || project.isLoaded) {
				updateProjectOperationProgress(project, 'project_status_rendering');
			}
		} else {
			updateProjectOperationProgress(project, 'project_status_ready_options');
		}
	} else {
		isStopRequested = false;
		isBatchWIP = isWIP;

		for (const element of getAllByTag('button', getAllByClass('menu-bar')[0])) {

			if (element.name !== 'download_all') {
				element.disabled = (
					element.name === 'stop'
					? !isWIP
					: isWIP
				);
			}
		}
	}

	return isWIP;
}

//* Page-specific functions: UI-side *-----------------------------------------

function getProjectFromEvent(evt) { return getProjectContainer(evt.target).project; }

function addEventListeners(element, funcByEventName) {
	for (const eventName in funcByEventName) {
		try {
			element.addEventListener(
				eventName
			,	funcByEventName[eventName]
			,	FLAG_EVENT_LISTENER_CAPTURE
			);

		} catch (error) {
			console.error(error);

			element.addEventListener(
				eventName
			,	funcByEventName[eventName]
			,	true
			);
		}
	}
}

function onBeforeUnload(evt) {
	evt = eventStop(evt, FLAG_EVENT_STOP_IMMEDIATE);

	if (
		ASK_BEFORE_EXIT_IF_OPENED_FILES
	&&	getOneById('loaded-files-view').firstElementChild
	) {

//* Note: given message text won't be used in modern browsers.
//* Source: https://habr.com/ru/post/141793/

	const	message = getLocalizedText('confirm_close_page');

		if (typeof evt === 'undefined') {
			evt = window.event;
		}

		if (evt) {
			evt.returnValue = message;
		}

		return message;
	}
}

function onResize(evt) {

//* Workaround for Firefox 56, reset style to recalculate:

const	style = document.documentElement.style;
	style.marginRight = 0;
	style.marginRight = '';

	updateDropdownMenuPositions(evt);
}

function updateDropdownMenuPositions(evt) {
	eventStop(evt, FLAG_EVENT_STOP_IMMEDIATE);

	for (const menuPanel of getAllByClass('menu-hid')) {
		putInView(menuPanel, 0,0, true);
	}
}

function onPageKeyDown(evt) {
	evt = evt || window.event;

	if (TESTING > 5) console.log('onPageKeyDown:', evt);

//* Esc:

	if (
		!(
			evt.altKey
		||	evt.ctrlKey
		||	evt.shiftKey
		) && (
			evt.which === 27
		||	evt.keyCode === 27
		||	evt.code === 'Escape'
		||	evt.key === 'Escape'
		)
	) {
		for (const job of pendingJobs) {
			job.isStopRequested = true;
		}

		for (const button of getAllByName('stop')) {
			button.click();
		}

		for (const button of getAllByClass('loading', getOneById('loaded-files-selection'))) {

			button.isStopRequested = true;

			if (button.project) {
				button.project.isStopRequested = true;
			}
		}
	}
}

function onProjectButtonClick(evt) {
	evt = evt || window.event;

let	button = evt;

	if (
		evt
	&&	evt.type
	&&	evt.type === 'click'
	&&	evt.target
	) {
		button = evt.target;
	}

	if (
		!button
	||	!button.tagName
	||	!(button = getThisOrParentByTagName(button, 'button'))
	) {
		return;
	}

	eventStop(evt, FLAG_EVENT_STOP_IMMEDIATE);

	if (button.disabled) {
		return;
	}

const	container = getProjectContainer(button);
const	project = container.project;
const	action = String(button.name);
const	actionWords = action.split(regNonAlphaNum);

	if (actionWords.includes('stop')) {
		project.isStopRequested = true;
	} else
	if (actionWords.includes('naming')) {
		if (actionWords.includes('reset')) {
			if (actionWords.includes('initial')) updateFileNamingPanel(project, 'initial');
			else updateFileNamingPanel(project, 'default');
		} else
		if (actionWords.includes('change')) updateFileNamingPanel(project, 'change');
		else updateFileNamingPanel(project);
	} else
	if (actionWords.includes('show')) {
		if (actionWords.includes('details')) {
			console.log(project);

			alert(getLocalizedText('see_console'));
		} else
		if (actionWords.includes('all')) showAll(project); else
		if (actionWords.includes('join')) showJoin(project);
		else showImg(project);
	} else
	if (actionWords.includes('save')) {
		if (actionWords.includes('ora')) saveProject(project); else
		if (actionWords.includes('zip')) saveZip(project); else
		if (actionWords.includes('all')) saveAll(project); else
		if (actionWords.includes('join')) saveJoin(project);
		else saveImg(project);
	} else
	if (actionWords.includes('reset')) {
	const	toIndex = actionWords.indexOf('to');

		if (actionWords.includes('switch')) setAllSwitches(
			project
		,	actionWords[toIndex - 1]
		,	actionWords[toIndex + 1]
		); else
		if (actionWords.includes('options')) setAllValues(
			project
		,	actionWords[toIndex + 1]
		);
	} else {
		console.error(
			'Unknown action: ' + action
		,	[
				evt
			,	button
			,	container
			,	project
			]
		);

		alert(getLocalizedText('unknown_button', action));
	}
}

async function onProjectMenuUpdate(evt) {
	evt = evt || window.event;

let	element = evt;

	if (
		evt
	&&	evt.type
	&&	evt.type === 'change'
	&&	evt.target
	) {
		element = evt.target;
	}

	if (
		!element
	||	!element.tagName
	) {
		return;
	}

	eventStop(evt, FLAG_EVENT_STOP_IMMEDIATE);

const	container = getProjectContainer(element);
const	project = container.project;

	if (element.type === 'checkbox') {
		updateCheckBox(element);

	const	key = element.getAttribute('data-switch-type');

		if (key !== 'layout') {
			updateFileNaming(project);
		}

		if (key === 'batch') {
			updateBatchCount(project);
		}

		return;
	}

	if (isSelectElement(element)) {
		updateSelectStyle(element);

	const	sectionName = element.getAttribute('data-section');
	const	listName = element.name;

		if (sectionName === 'collage') {
			return;
		}

		if (
			sectionName === 'separate'
		&&	listName === 'naming'
		) {
		const	batchOptions = project.renderBatchSelectedOptions;
		const	batchSets = project.renderBatchSelectedSets;
		const	menuValues = project.selectedMenuValues;
		const	selectValue = element.value;

			try {
				if (menuValues) {
					menuValues.separate.naming = selectValue;
				}

				if (batchOptions) {
					batchOptions.separate.naming[0] = selectValue;
				}

				if (batchSets) {
					for (const fileName in batchSets) {
						batchSets[fileName].separate.naming = selectValue;
					}
				}

			} catch (error) {
				console.error(error);

				if (TESTING) console.log('onProjectMenuUpdate:', [
					sectionName,
					listName,
					selectValue,
					batchOptions,
					batchSets,
				]);

				project.renderBatchSelectedOptions = null;
				project.renderBatchSelectedSets = null;
				project.selectedMenuValues = null;
			}

			updateSaveFileName(project);

			return;
		}

		await updateBatchCount(project);
		await updateMenuAndShowImg(project);

		updateFileNaming(project);
	}
}

function updateSaveFileName(project) {

const	values = getSelectedMenuValues(project);
const	element = project.currentFileNamePreview;
const	fileName = project.currentFileName = getFileNameByValuesToSave(
		project
	,	values
	,	FLAG_FILENAME_TO_SAVE
	) + '.png';

	if (element) {
		element.textContent = fileName;
	}
}

function updateDraggedElement(evt) {
	if (
		evt
	&&	evt.type
	&&	evt.type === 'dragstart'
	) {
		return draggedElement = getDraggableElementOrParent(evt.target);
	}

	if (
		evt
	&&	evt.type
	&&	evt.type === 'drop'
	) {
		return draggedElement = null;
	}
}

function onPanelDragStart(evt) {

	if (!isElementOrAnyParentDraggable(evt.target)) {
		return;
	}

	evt = eventStop(evt, FLAG_EVENT_STOP_IMMEDIATE);

	if (!updateDraggedElement(evt)) {
		return;
	}

const	sectionHeader = draggedElement.firstElementChild || draggedElement.parentNode.firstElementChild;
const	sectionName = sectionHeader.name || sectionHeader.textContent;
let	content;

	if (draggedElement.firstElementChild) {
		content = sectionName;
	} else {
		content = sectionName + '\n' + (draggedElement.name || draggedElement.textContent);
	}

	evt.dataTransfer.effectAllowed = 'move';
	evt.dataTransfer.setData('text/plain', DRAG_ORDER_PREFIX + content);
}

function onPanelDragMove(evt) {

	if (!isElementOrAnyParentDraggable(evt.target)) {
		updateDraggedElement(evt);

		return;
	}

	if (!draggedElement) {
		return;
	}

	evt = eventStop(evt, FLAG_EVENT_STOP_IMMEDIATE);

const	targetElement = evt.target;

	if (
		targetElement
	&&	targetElement.draggable
	&&	targetElement !== draggedElement
	&&	targetElement.parentNode
	&&	targetElement.parentNode === draggedElement.parentNode
	) {
		evt.dataTransfer.dropEffect = 'move';

		targetElement.parentNode.insertBefore(
			draggedElement
		,	(
				isElementAfterSibling(draggedElement, targetElement)
				? targetElement
				: targetElement.nextSibling
			)
		);

		updateSaveFileName(getProjectFromEvent(evt));
	}

	updateDraggedElement(evt);
}

function onPageDragOver(evt) {
	evt = eventStop(evt, FLAG_EVENT_NO_DEFAULT);

const	batch = evt.dataTransfer;
const	files = batch.files;
const	items = batch.items;
let	itemsArray;

	batch.dropEffect = (
		hasPrefix(batch.getData('text/plain'), DRAG_ORDER_PREFIX)
		? (
			isElementOrAnyParentDraggable(evt.target)
			? 'move'
			: 'none'
		)
		: (
			(files && files.length > 0)
		||	(items && items.length > 0 && Array.from(items).some((item) => (item.kind === 'file')))
			? 'copy'
			: 'none'
		)
	);
}

function onPageDrop(evt) {
	evt = eventStop(evt, FLAG_EVENT_NO_DEFAULT) || evt;

	updateDraggedElement(evt);

	if (
		evt
	&&	evt.dataTransfer
	&&	hasPrefix(evt.dataTransfer.getData('text/plain'), DRAG_ORDER_PREFIX)
	) {
		return;
	}

const	filesToLoad = [];
let	files, name, ext;

//* get list of files to process:

	for (const batch of [
		evt.dataTransfer
	,	evt.target
	,	evt.files
	,	evt.value
	,	evt
	]) if (
		batch
	&&	(files = batch.files)
	&&	files.length
	) {
		if (TESTING > 1) console.log(batch);

		for (const file of files)
		if (
			file
		&&	(name = file.name).length > 0
		&&	(ext = getFileExt(name)).length > 0
		) {
			filesToLoad.push({ evt, file, name, ext });
		}
	}

//* process files:

	loadFromFileList(filesToLoad, evt);
}

async function loadFromFileList(files, evt) {
let	loadedProjectsCount = 0;
const	startTime = getTimeNow();
const	thisJob = { startTime, files, evt };
	pendingJobs.add(thisJob);

	if (
		files
	&&	files.length > 0
	) {
	const	logLabel = [
			'Load'
		,	files.length
		,	'project files:'
		,	getNestedFilteredArrayJoinedText(
				files.length < 10
				? files.map((file) => file.name)
				: Object.entries(
					files.reduce(
						(countsByExt, file) => {

							file.ext in countsByExt
							? ++countsByExt[file.ext]
							: countsByExt[file.ext] = 1;

							return countsByExt;
						}
					,	{}
					)
				)
				.sort(arrayFromObjectEntriesSortByKey)
				.map(([key, count]) => count + ' ' + key)
			,	', '
			)
		].join(' ');

		console.time(logLabel);
		if (USE_CONSOLE_LOG_GROUPING) console.group(logLabel);

		for (const file of files) {
			if (await addProjectViewTab(file, startTime)) {
				++loadedProjectsCount;
			}

			if (isStopRequestedAnywhere(thisJob)) {
				break;
			}
		}

		if (USE_CONSOLE_LOG_GROUPING) console.groupEnd(logLabel);
		console.timeEnd(logLabel);

		console.log('Loaded ' + loadedProjectsCount + ' of ' + files.length + ' project files.');
	} else if (TESTING) {
		console.error('Cannot load files:', [files, 'From event:', evt]);
	}

	pendingJobs.delete(thisJob);

	return loadedProjectsCount;
}

async function loadFromURL(url, startTime) {
	if (!url) {
		return;
	}

const	logLabel = 'Load project from url: ' + url;

	console.time(logLabel);
	if (USE_CONSOLE_LOG_GROUPING) console.group(logLabel);

const	isProjectLoaded = await addProjectViewTab({ url }, startTime);

	if (USE_CONSOLE_LOG_GROUPING) console.groupEnd(logLabel);
	console.timeEnd(logLabel);

	return isProjectLoaded;
}

async function loadFromButton(button, startTime, inBatch) {

	function getButtonURL(button) {
	let	url = button.getAttribute('data-url');
	let	container, link;

		if (
			!url
		&&	(container = getThisOrParentByClass(button, regClassExampleFile))
		&&	(link = getAllByTag('a', container)[0])
		) {
			url = link.href;
		}

		return url;
	}

	if (!inBatch) {
		if (button.disabled) {
			return;
		}

		button.disabled = true;
	}

	if (!startTime) {
		startTime = getTimeNow();
	}

const	action = button.name || button.getAttribute('data-action');
const	urls = [];
let	url;
let	isProjectLoaded = false;

	if (action) {
	const	filesTable = getThisOrParentByClass(button, regClassExampleFiles);

		if (action === 'stop') {
			isStopRequested = true;
		} else
		if (action === 'download_all') {
		let	countWithoutPause = 0;

			for (const link of getAllByTag('a', filesTable)) {
				if (link.download) {

					link.click();

//* Note: Chrome skips downloads if more than 10 in 1 second.
//* Source: https://stackoverflow.com/a/53841885

					if (++countWithoutPause >= 10) {
						countWithoutPause = 0;

						await pause(1000);
					}
				}
			}
		} else
		if (action === 'load_all') {
			setWIPstate(true);

			for (const otherButton of getAllByTag('button', filesTable)) {
				if (url = getButtonURL(otherButton)) {

					addToListIfNotYet(urls, url);

					if (await loadFromButton(otherButton, startTime, true)) {
						isProjectLoaded = true;
					}

					if (isStopRequested) {
						isStopRequested = false;

						break;
					}
				}
			}

			setWIPstate(false);
		} else {
			console.error('Unknown action: ' + action, [button, filesTable]);
		}
	} else
	if (url = getButtonURL(button)) {

//* show loading status:

	const	className = 'loading';
	const	fileRow = getThisOrParentByClass(button, regClassExampleFile);

		if (fileRow && fileRow.className) {
			if (fileRow.classList.contains(className)) {
				return;
			} else {
				toggleClass(fileRow, className, 1);
			}
		}

//* process the file:

		isProjectLoaded = await loadFromURL(url, startTime);

//* remove loading status:

		if (fileRow && fileRow.className) {
			toggleClass(fileRow, className, -1);
		}

	}

	if (!inBatch) {
		button.disabled = false;
	}

	return isProjectLoaded;
}

function selectProject(buttonTab, autoSelected) {
	if (buttonTab = getProjectButton(buttonTab)) {
	let	otherButtonTab = buttonTab.parentNode.firstElementChild;

		while (otherButtonTab) {
		const	selectedState = (otherButtonTab === buttonTab ? 1 : -1);

			for (const element of getAllById(otherButtonTab.id)) {
				toggleClass(element, 'show', selectedState);
			}

			otherButtonTab = otherButtonTab.nextElementSibling;
		}

		if (!autoSelected) {
			lastTimeProjectTabSelectedByUser = getTimeNow();
		}
	}
}

function closeProject(buttonTab) {
	if (buttonTab = getProjectButton(buttonTab)) {
	const	buttonClass = buttonTab.className || '';
	const	fileId = buttonTab.id;
	const	project = buttonTab.project;

		if (regClassShow.test(buttonClass)) {
			selectProject(
				getNextSiblingByClass(buttonTab, regClassLoaded)
			||	getPreviousSiblingByClass(buttonTab, regClassLoaded)
			);
		}

//* Note: if loading did not complete, the loader function will do cleanup.

		if (regClassLoading.test(buttonClass)) {
			toggleClass(buttonTab, 'failed', 1);

			buttonTab.isStopRequested = true;

			if (project) {
				project.isStopRequested = true;
			}
		}

		if (regClassLoaded.test(buttonClass)) {
			removeProjectView(fileId);
		}

	const	revokedBlobsCount = revokeBlobsFromTrackList(project);

		if (revokedBlobsCount) {
			if (TESTING > 1) console.log('Closed project:', [project, 'revoked blobs:', revokedBlobsCount]);
		}
	}
}

//* Runtime: prepare UI *------------------------------------------------------

async function initUI() {
const	logLabelWrap = 'Init';
	console.time(logLabelWrap);
	if (USE_CONSOLE_LOG_GROUPING) console.group(logLabelWrap);

let	logLabel = `Init localization "${LANG}"`;
	console.time(logLabel);

	toggleClass(document.body, 'loading', 1);
	await loadLibPromise(LIB_LANG_DIR + 'localization.' + LANG + '.js');
	document.body.innerHTML = getLocalizedHTML('loading');

	console.timeEnd(logLabel);

//* remember config defaults:

const	configVarDefaults = {};
const	configVarNames = [
		'DEFAULT_ALPHA_MASK_PADDING',
		'DEFAULT_ALPHA_MASK_THRESHOLD',
		'DEFAULT_AUTOCROP',
		'DEFAULT_COLLAGE_ALIGN',
		'DEFAULT_COLLAGE_COLORS',
		'DEFAULT_COLLAGE_PADDING',
		'DEFAULT_COLLAGE_PADDING_INSIDE',
		'DEFAULT_COLLAGE_PADDING_OUTSIDE',
		'ORA_EXPORT_THUMBNAIL_SIZE',
		'PAUSE_WORK_DURATION',
		'PAUSE_WORK_INTERVAL',
		'PREVIEW_SIZE',
		'TAB_PREVIEW_SIZE',
		'TAB_THUMBNAIL_SIZE',
		'TAB_ZOOM_STEP_MAX_FACTOR',
		'THUMBNAIL_SIZE',
		'ZOOM_STEP_MAX_FACTOR',
	];

	for (const varName of configVarNames) {
		configVarDefaults[varName] = window[varName];
	}

//* load redefined config:

	logLabel = 'Init external config';
	console.time(logLabel);

	await loadLibPromise(CONFIG_FILE_PATH);

	console.timeEnd(logLabel);

//* restore invalid config values to default:

	for (const varName of configVarNames) {

	const	configuredValue = orz(window[varName]);
	const	invalidBottom = (varName.includes('FACTOR') ? 1 : 0);

		window[varName] = (
			configuredValue > invalidBottom
			? configuredValue
			: configVarDefaults[varName]
		);
	}

//* finalize config values format:

	initLibParams();

	DEFAULT_COLLAGE_ALIGN = getNestedFilteredArrayJoinedText(DEFAULT_COLLAGE_ALIGN, '/');
	DEFAULT_COLLAGE_COLORS = getNestedFilteredArrayJoinedText(DEFAULT_COLLAGE_COLORS, '/');
	DEFAULT_COLLAGE_PADDING = getNestedFilteredArrayJoinedText(
		[
			getNestedFilteredArrayEnclosedJoinedText(DEFAULT_COLLAGE_PADDING_OUTSIDE, 'border=', 'px', '/'),
			getNestedFilteredArrayEnclosedJoinedText(DEFAULT_COLLAGE_PADDING_INSIDE, 'padding=', 'px', '/'),
			getNestedFilteredArrayEnclosedJoinedText(DEFAULT_COLLAGE_PADDING, '', 'px', '/'),
		]
	,	'/'
	);

	DEFAULT_COLLAGE = getNestedFilteredArrayJoinedText(
		[
			DEFAULT_COLLAGE_ALIGN,
			DEFAULT_COLLAGE_COLORS,
			DEFAULT_COLLAGE_PADDING,
		]
	,	'/'
	);

	PRELOAD_LAYER_IMAGES = (
		PRELOAD_ALL_LAYER_IMAGES
	||	PRELOAD_USED_LAYER_IMAGES
	);

//* check loading local files:

let	canLoadLocalFiles = true;

	if (RUNNING_FROM_DISK) {
		logTime('Init: try loading local file.');

		canLoadLocalFiles = !! await getFilePromiseFromURL(FETCH_TEST_FILE_PATH).catch(catchPromiseError);
	}

	if (!canLoadLocalFiles) {
		logTime('Init: running from disk, cannot load local files.');
	}

//* load libraries not specific to file formats:

	logLabel = 'Init libraries';
	console.time(logLabel);

	await loadLibPromise(LIB_UTIL_DIR + 'composition.asm.js');

	if (CompositionModule = AsmCompositionModule) {
		CompositionFuncList = Object.keys(CompositionModule(window, null, new ArrayBuffer(nextValidHeapSize(0))));
	}

	console.timeEnd(logLabel);

//* create main menu:

	logLabel = 'Init menu: file types';
	console.time(logLabel);

const	todoText = getLocalizedText('todo');
const	todoHTML = '<p>' + getLocalizedHTML('todo') + '</p>';
const	fileTypesByKeys = {};
const	inputFileAcceptTypes = [];

	for (const loader of FILE_TYPE_LOADERS) {

	const	exts = loader.dropFileExts || DUMMY_EMPTY_ARRAY;
	const	mimeTypes = loader.inputFileAcceptMimeTypes || DUMMY_EMPTY_ARRAY;
	const	lowerCaseExts = exts.map((ext) => ext.toLowerCase());
	const	upperCaseExts = exts.map((ext) => ext.toUpperCase());
	const	key = upperCaseExts.shift();
	const	otherTypesByKey = getOrInitChild(fileTypesByKeys, key, Array);

		for (const ext of upperCaseExts) {
			addToListIfNotYet(otherTypesByKey, ext);
		}

		for (const ext of lowerCaseExts) {
			addToListIfNotYet(inputFileAcceptTypes, '.' + ext);
		}

		for (const mimeType of mimeTypes) {
			addToListIfNotYet(inputFileAcceptTypes, mimeType.toLowerCase());
		}
	}

const	supportedFileTypesText = (
		Object
		.keys(fileTypesByKeys)
		.sort()
		.map(
			(key) => {
			const	otherTypesByKey = fileTypesByKeys[key];
			let	text = key;

				if (otherTypesByKey.length > 0) {
					text += ' (' + otherTypesByKey.sort().join(', ') + ')';
				}

				return text;
			}
		)
		.join(', ')
	)
,	inputFileAcceptTypesText = inputFileAcceptTypes.sort().join(', ')
,	openingNotesHTML = getLocalizedHTML('file_notes')
,	menuHTMLparts = {};

	menuHTMLparts.file = (
		'<p>'
	+		getLocalizedHTML('file_select_project')
	+		':'
	+	'</p>'
	+	'<input type="file" onchange="onPageDrop(this)" multiple accept="'
	+		encodeTagAttr(inputFileAcceptTypesText)
	+	'">'
	+	'<p>'
	+		getLocalizedHTML('file_formats')
	+		':\n'
	+		supportedFileTypesText
	+		'.'
	+	'</p>'
	+	'<hr>'
	+	'<p>'
	+		openingNotesHTML
	+	'</p>'
	);

	console.timeEnd(logLabel);

	logLabel = 'Init menu: example files';
	console.time(logLabel);

	function getExampleHeaderRow(content, rowLength) {
		return (
			'<tr>'
		+		'<th colspan="' + rowLength + '">'
		+			content
		+		'</th>'
		+	'</tr>'
		);
	}

	function getExampleButtonsRow(tabs, rowLength) {
		if (tabs.map) {
			return (
				tabs.map(
					(tabs) => getExampleButtonsRow(tabs, rowLength)
				).join('')
			);
		}

		tabs = Object.entries(tabs);

	const	padCount = orz(rowLength) - orz(tabs.length);
	const	padHTML = (
			padCount === 0
			? '' :
			'<td' + (
				padCount === 1
				? '' :
				' colspan="' + padCount + '"'
			) + '></td>'
		);

	const	tabsHTML = (
			tabs.map(
				([ name, label ]) => (
					(
						!canLoadLocalFiles
					&&	!name.includes('download')
					) ? '' : (
						'<td>'
					+		'<button onclick="return loadFromButton(this)" name="'
					+			encodeTagAttr(name)
					+		'">'
					+			getLocalizedText(label)
					+		'</button>'
					+	'</td>'
					)
				)
			).join('')
		);

		return (
			'<tr class="batch-buttons">'
		+		padHTML
		+		tabsHTML
		+	'</tr>'
		);
	}

let	tabsCountMax = 0;
let	totalFilesCount = 0;

const	examplesHTML = getNestedFilteredArrayJoinedText(
		exampleProjectFiles.map(
			(fileGroup) => {
			const	subdir = fileGroup.subdir || '';
			const	headerHTML = (
					!subdir
					? '' :
					'<header>'
				+		getLocalizedHTML(subdir)
				+		':'
				+	'</header>'
				);

			let	tabsCount = 0;
			const	filesCount = fileGroup.files.length;
			const	fileListHTML = getNestedFilteredArrayJoinedText(
					fileGroup.files.map(
						(file) => {
						const	fileName = (
								file.length
							&&	file.length > 0
							&&	file[0]
								? file[0]
								: file.name || file || '?'
							);

						const	fileInfo = (
								file.length
							&&	file.length > 1
							&&	file[1]
								? '(' + file[1] + ')'
								: getNestedFilteredArrayJoinedText(
									[
										file.pixels
									,	getFormattedFileSize(
											file.bytes
										,	file.filesize
										)
									]
								,	', '
								)
							);

						const	thumbnail = (
								'<div class="thumbnail-hover">'
							+	(
									!file.thumbnail
									? '' :
									'<img class="thumbnail" src="'
								+		encodeHTMLSpecialChars(file.thumbnail)
								+	'">'
								)
							+	(
									!file.preview
									? '' :
									'<img class="thumbnail larger" src="'
								+		encodeHTMLSpecialChars(file.preview)
								+	'">'
								)
							+	'</div>'
							);

						const	filePath = getNestedFilteredArrayJoinedText([exampleRootDir, subdir, fileName], '/');
						const	fileURL = filePath + '?version=' + file.modtime.replace(regNonWord, '_');
						const	nameAttr = encodeTagAttr(fileName);
						const	pathAttr = encodeTagAttr(fileURL);

						const	downloadLink = (
								'<a href="'
							+		pathAttr
							+	'" download="'
							+		nameAttr
							+	'">'
							+		getLocalizedHTML('download_file')
							+	'</a>'
							);

						const	loadButton = (
								!canLoadLocalFiles
								? '' :
								'<button onclick="return loadFromButton(this)">'
							+		getLocalizedHTML('open_example_file')
							+	'</button>'
							);

						const	tabs = [
								fileName
							,	thumbnail
							,	fileInfo
							,	getFormattedTime(file.modtime)
							,	downloadLink
							,	loadButton
							];

						const	tabsHTML = getNestedFilteredArrayJoinedText(
								tabs.map(
									(tabContent) => (
										'<td>'
									+		tabContent
									+	'</td>'
									)
								)
							);

							tabsCount = Math.max(tabsCount, tabs.length);
							tabsCountMax = Math.max(tabsCount, tabsCountMax);

							return (
								'<tr class="example-file">'
							+		tabsHTML
							+	'</tr>'
							);
						}
					)
				);

			const	batchButtonsHTML = (
					filesCount > 1
					? getExampleButtonsRow(EXAMPLE_CONTROLS, tabsCount)
					: '<tr><td colspan="' + tabsCountMax + '"></td></tr>'
				);

				totalFilesCount += filesCount;

				return (
					'<tbody class="example-file-type">'
				+		getExampleHeaderRow(headerHTML, tabsCount)
				+		fileListHTML
				+		batchButtonsHTML
				+	'</tbody>'
				);
			}
		)
	);

const	batchButtonsHTML = (
		totalFilesCount > 1
		? (
			'<tfoot>'
		+		getExampleButtonsRow(EXAMPLE_CONTROLS, tabsCountMax)
		+	'</tfoot>'
		) : ''
	);

	menuHTMLparts.examples = (
		!EXAMPLE_NOTICE
		? '' :
		'<p class="warning">'
	+		getLocalizedHTML('examples_notice')
	+	'</p>'
	) + (
		'<table class="example-files">'
	+		examplesHTML
	+		batchButtonsHTML
	+	'</table>'
	);

	console.timeEnd(logLabel);

	logLabel = 'Init menu: help';
	console.time(logLabel);

	function getHelpSectionLinkAwayHTML(linkName) {
	const	url = getLocalizedOrEmptyText(linkName);

	const	linkAttr = (
			url
			? encodeTagAttr(url) + '" class="external-link'
			: encodeTagAttr(`javascript:alert(getLocalizedText('unknown_link', '${linkName}'))`)
		);

	const	linkText = (
			getLocalizedOrEmptyText(linkName + '_text')
		||	linkName
		);

		return (
			'<a href="'
		+		linkAttr
		+	'">'
		+		linkText
		+	'</a>'
		);
	}

	function getHelpSectionLinkHTML(sectionName) {
		return (
			`<a onclick="showHelpSection('`
		+		encodeTagAttr(sectionName)
		+	`', this)" class="section-link">`
		+		getLocalizedText(sectionName)
		+	'</a>'
		);
	}

	function getCodeTableHTML() {
		return replaceAll(
			getTableHTML(...arguments)
		,	['[', '<code class="param">']
		,	[']', '</code>']
		);
	}

	function getArrayCodeReplaceSlashToNewLine(...values) {
		return values.map(
			(value) => wrap.code.list(
				isFunction(value.split)
				? value.split('/').join('\n')
				: value
			)
		);
	}

	function getCodeListNameAndOrPrefix(...values) {
		return values.map(
			(value) => (
				isArray(value)
				? (
					wrap.span.name(
						value[0]
					&&	value[0].length > 0
					&&	value[0]
						.replace(regNumDots, '')
						.replace(regCommaSpace, '')
						.length > 0
						? value[0]
						: '{help_code_list_name}' + value[0]
					)
					+ (value.length <= 1 ? '' : '[' + value[1])
					+ (value.length <= 2 ? '' : ']' + value[2])
				)
				: '[' + value
			)
		);
	}

	function getCodeColoredParamWithListName(...values) {
		return values.map(
			(value) => (
				isArray(value)
				? (
					'['
					+ value[0]
					+ (value.length <= 1 ? '' : wrap.span.sample(value[1]))
					+ ']'
					+ (value.length <= 2 ? '' : wrap.span.name('{help_code_list_name}' + value[2]))
				)
				: (
					'[' + value + ']'
					+ wrap.span.name('{help_code_list_name}')
				)
			)
		);
	}

	function getCodeColoredParamPercentages(...values) {
		return values.map(
			(value) => getCodeListNameAndOrPrefix(value)
			+ wrap.span.sample('10/20/'
			+ wrap.span.custom('({help_code_more_numbers})')
			+ '/100%')
			+ ']'
		);
	}

	function getCodeColoredParamAlias(...values) {
		return values.map(
			(value) => getCodeListNameAndOrPrefix(value)
			+ wrap.span.sample('{help_code_alias}')
			+ ']'
		);
	}

	function getCodeColoredParamOutline(...values) {
		return values.map(
			(value) => wrap.span.name('{help_code_list_name_padding}')
			+ '[outline '
			+ wrap.span.sample(value)
			+ ']'
		);
	}

	function getCodeColoredParamOutlineColorValue(...values) {
		return values.map(
			(value) => wrap.span.name('{help_code_list_name_padding}')
			+ '['
			+ wrap.span.custom('red')
			+ ' outline '
			+ wrap.span.sample(value)
			+ ']'
		);
	}

	function getCodeColoredParamParts(parentParam, childParam) {
		return NAME_PARTS_FOLDERS.map(
			(listType) => [
				'[if ' + (parentParam || '') + wrap.span.sample(listType) + ']',
				wrap.span.name('{help_code_list_name_' + listType + '}'),
				wrap.span.path('/') + (childParam || ''),
				wrap.span.name('{help_code_option_name_' + listType.slice(0, -1) + '}'),
			]
		);
	}

	function getCodeColoredParamPartsAny(parentParam, childParam) {
		return [
			...NAME_PARTS_FOLDERS.map(
				(listType) => [
					'[if ' + wrap.span.sample(listType) + ']',
					wrap.span.name('{help_code_list_name_' + listType + '}'),
					'[' + (childParam || '') + 'none]',
				]
			),
			...NAME_PARTS_FOLDERS.map(
				(listType) => [
					'[if ' + (parentParam || '') + 'any ' + wrap.span.sample(listType) + ']',
					wrap.span.name('{help_code_list_name_' + listType + '} 1, 2'),
				]
			),
		];
	}

	function getSaveFileNamingExample(name) {
		return (
			wrap.span.button('{save_png}')
			+ ' → '
			+ wrap.span.filename(
				getLocalizedText(name).replace(
					/(\[)([^\[\].]+)(\])/g
				,	(match, open, inside, close) => (
						open
						+ wrap.span.variant(inside)
						+ close
					)
				)
			)
		);
	}

const	wrap = {
		'code' : {},
		'span' : {},
	};

const	wrapperClassNames = [
		'button-text',
		'comment',
		'custom param value',
		'filename',
		'folder ignore',
		'ignore',
		'list param',
		'name',
		'nested-layer ignore',
		'param',
		'path',
		'sample param value',
		'variant',
	];

	for (const className of wrapperClassNames) {
	const	key = className.split(regNonAlphaNum)[0];

		for (const tagName in wrap) {
			wrap[tagName][key] = (...values) => (
				'<' + tagName + ' class="' + className + '">'
			+		values.join('')
			+	'</' + tagName + '>'
			);
		}
	}

const	helpSections = {
		'autocrop' : [
			{
				'text_key' : 'notes',
			}, {
				'code_sample' : '[autocrop='
					+ wrap.span.custom('{help_code_color_value}/{help_code_color_value}2/({help_code_more_values})')
					+ ']',
				'text_key' : 'color',
				'text_replace_values' : getHelpSectionLinkHTML('help_color_value'),
			}, {
				'code_sample' : '[autocrop='
					+ wrap.span.sample('top-left/top-right/bottom-left/bottom-right')
					+ ']',
				'text_key' : 'corner',
			}, {
				'code_sample' : '[autocrop='
					+ wrap.span.sample('all/etc')
					+ ']',
				'text_key' : 'all',
			}, {
				'code_sample' : '[autocrop]',
				'text_key' : 'default',
				'text_replace_values' : getArrayCodeReplaceSlashToNewLine(DEFAULT_AUTOCROP),
			},
		],
		'batch' : [
			{
				'text_key' : 'notes',
				'text_replace_values' : [
					getTableHTML(
						[
							'1.',
							[
								'<code>',
									wrap.code.param('[' + wrap.span.sample('parts') + ' batch]'),
									wrap.span.name('{help_code_list_name_parts}'),
								'</code>',
							],
						], [
							'2.',
							[
								'<code>',
									wrap.code.param('[' + wrap.span.sample('colors') + ' rows]'),
									wrap.span.name('{help_code_list_name_colors}'),
								'</code>',
							],
						], [
							'3.',
							[
								wrap.code.param('[' + wrap.span.sample('zoom=50/100%') + ' no-batch]'),
							],
						],
					),
				],
			}, {
				'code_sample' : [
					wrap.span.name('{help_code_list_name}') + '[batch]',
					wrap.span.name('{help_code_list_name}') + '[batched]',
				],
				'text_key' : 'all',
			}, {
				'code_sample' : [
					wrap.span.name('{help_code_list_name}') + '[no-batch]',
					wrap.span.name('{help_code_list_name}') + '[single]',
				],
				'text_key' : 'single',
			}, {
				'code_sample' : [
					wrap.span.name('{help_code_list_name}') + '[omitable]',
					wrap.span.name('{help_code_list_name}') + '[omit-single]',
					wrap.span.name('{help_code_list_name}') + '[no-single-name]',
				],
				'text_key' : 'omitable',
			}, {
				'code_sample' : [
					wrap.span.name('{help_code_list_name}') + '[unomitable]',
					wrap.span.name('{help_code_list_name}') + '[add-single]',
					wrap.span.name('{help_code_list_name}') + '[single-name]',
				],
				'text_key' : 'unomitable',
			}, {
				'code_sample' : [
					wrap.span.name('{help_code_list_name}') + '[inline]',
					wrap.span.name('{help_code_list_name}') + '[columns]',
				],
				'text_key' : 'inline',
			}, {
				'code_sample' : [
					wrap.span.name('{help_code_list_name}') + '[newline]',
					wrap.span.name('{help_code_list_name}') + '[rows]',
				],
				'text_key' : 'newline',
			},
		],
		'clone' : [
			{
				'text_key' : 'notes',
			}, {
				'code_sample' : getCodeColoredParamAlias('copy='),
				'text_key' : 'copy',
				'text_replace_values' : '{help_code_alias}',
			}, {
				'code_sample' : getCodeColoredParamAlias('paste='),
				'text_key' : 'paste',
				'text_replace_values' : '{help_code_alias}',
			}, {
				'code_sample' : '[paste-above=' + wrap.span.sample('A') + ']',
				'text_key' : 'paste_above',
				'text_replace_values' : wrap.code.param('[paste]'),
			}, {
				'code_sample' : '[paste-below=' + wrap.span.sample('B') + ']',
				'text_key' : 'paste_below',
				'text_replace_values' : [
					wrap.code.param('[paste]'),
					wrap.code.param('[paste-above]'),
				],
			}, {
				'code_sample' : [
					wrap.span.name('{help_code_name} 1, 2') + '[copy]',
					wrap.span.name('{help_code_name} 1, 2') + '[paste]',
				],
				'text_key' : 'layer_names',
			}, {
				'code_sample' : [
					'[copy=]',
					'[paste=]',
				],
				'text_key' : 'empty_id',
			}, {
				'code_sample' : '[copy=' + wrap.span.custom('A') + ' copy=' + wrap.span.sample('B') + ']',
				'text_key' : 'multi_copy',
			}, {
				'code_sample' : '[paste=' + wrap.span.custom('A') + ' paste=' + wrap.span.sample('B') + ']',
				'text_key' : 'multi_paste',
			},
		],
		'collage' : [
			{
				'text_key' : 'notes',
			}, {
				'code_sample' : '[collage='
					+ wrap.span.custom('{help_code_color_value}/{help_code_color_value}2/({help_code_more_values})')
					+ ']',
				'text_key' : 'color',
				'text_replace_values' : getHelpSectionLinkHTML('help_color_value'),
			}, {
				'code_sample' : '[collage='
					+ wrap.span.sample('border=(0,1,2,5...10)px')
					+ ']',
				'text_key' : 'border',
			}, {
				'code_sample' : '[collage='
					+ wrap.span.sample('padding=(0,1,2,5...10)px')
					+ ']',
				'text_key' : 'padding',
			}, {
				'code_sample' : '[collage='
					+ wrap.span.sample('(0,1,2,5...10)px/'
					+ wrap.span.custom('({help_code_more_numbers})')
					+ 'px')
					+ ']',
				'text_key' : 'pixels',
			//* TODO:
			// }, {
				// 'code_sample' : '[collage=top-left/top-right/bottom-left/bottom-right/top/bottom/left/right]',
				// 'text_key' : 'align',
			// }, {
				// 'code_sample' : '[collage=all/etc]',
				// 'text_key' : 'all',
			}, {
				'code_sample' : '[collage]',
				'text_key' : 'default',
				'text_replace_values' : [
					getTableHTML(
						{
							'cell_tag_name' : 'th',
							'cells' : [
								'{help_collage_default_colors}',
								'{help_collage_default_align}',
								'{help_collage_default_padding}',
							],
						}, getArrayCodeReplaceSlashToNewLine(
							DEFAULT_COLLAGE_COLORS,
							DEFAULT_COLLAGE_ALIGN,
							DEFAULT_COLLAGE_PADDING,
						),
					),
					getHelpSectionLinkAwayHTML('help_color_value_names_link'),
				],
			},
		],
		'color_value' : [
			{
				'text_key' : 'notes',
				'text_replace_values' : [
					getCodeTableHTML(
						{
							'cell_tag_name' : 'th',
							'cells' : [
								'{help_color_value_table_short_hex}',
								'{help_color_value_table_split_hex}',
								'{help_color_value_table_split_dec}',
							],
						}, [
							'[#' + wrap.span.sample('1') + ']',
							'[hex=' + wrap.span.sample('11-11-11') + ']',
							'[rgb=' + wrap.span.sample('17-17-17') + ']',
						], [
							'[#' + wrap.span.sample('12') + ']',
							'[hex=' + wrap.span.sample('12-12-12') + ']',
							'[rgb=' + wrap.span.sample('18-18-18') + ']',
						], [
							'[#' + wrap.span.sample('123') + ']',
							'[hex=' + wrap.span.sample('11-22-33') + ']',
							'[rgb=' + wrap.span.sample('17-34-51') + ']',
						], [
							'[#' + wrap.span.sample('1234') + ']',
							'[hex=' + wrap.span.sample('11-22-33-44') + ']',
							'[rgba=' + wrap.span.sample('17-34-51-68') + ']',
						], [
							'[#' + wrap.span.sample('12345') + ']',
							'[hex=' + wrap.span.sample('12-34-5') + ']',
							'[rgb=' + wrap.span.sample('18-52-5') + ']',
						], [
							'[#' + wrap.span.sample('123456') + ']',
							'[hex=' + wrap.span.sample('12-34-56') + ']',
							'[rgb=' + wrap.span.sample('18-52-86') + ']',
						], [
							'[#' + wrap.span.sample('1234567') + ']',
							'[hex=' + wrap.span.sample('12-34-56-7') + ']',
							'[rgba=' + wrap.span.sample('18-52-86-7') + ']',
						], [
							'[#' + wrap.span.sample('12345678') + ']',
							'[hex=' + wrap.span.sample('12-34-56-78') + ']',
							'[rgba=' + wrap.span.sample('18-52-86-120') + ']',
						],
					),
					getHelpSectionLinkAwayHTML('help_color_value_names_link'),
				],
			}, {
				'code_sample' : [
					'[rgb=' + wrap.span.sample('10-20-30') + ']',
					'[rgba=' + wrap.span.sample('0-100-200-255') + ']',
					'[rgba' + wrap.span.sample('(0,100,200,255)') + ']',
				],
				'text_key' : 'split_dec',
			}, {
				'code_sample' : [
					'[hex=' + wrap.span.sample('12-34-56') + ']',
					'[hex=' + wrap.span.sample('12-34-ab-cd') + ']',
					'[hex' + wrap.span.sample('(12,34,ab,cd)') + ']',
				],
				'text_key' : 'split_hex',
			}, {
				'code_sample' : '[#' + wrap.span.sample('1234abcd') + ']',
				'text_key' : 'short_hex',
			}, {
				'code_sample' : '[transparent]',
				'text_key' : 'transparent',
				'text_replace_values' : wrap.code.param('[rgba' + wrap.span.sample('(0,0,0,0)') + ']'),
			},
		],
		'colors' : [
			{
				'text_key' : 'notes',
				'text_replace_values' : [
					wrap.code.param('[no-render]'),
					getHelpSectionLinkHTML('help_other'),
					getTableHTML(
						[
							'{help_code_list_folder}:',
							[
								'<code>',
									wrap.span.folder(),
									wrap.code.param('[colors]'),
									wrap.span.name('{help_code_list_name_colors}'),
								'</code>',
							],
						], [
							'{help_code_option_layer}:',
							[
								'<code>',
									wrap.span.nested(),
									wrap.span.name('{help_code_option_name_color} 1'),
									wrap.code.custom('[red]'),
								'</code>',
							],
						], [
							'{help_code_option_nested}:',
							[
								'<code>',
									wrap.span.nested(),
									wrap.span.comment('({help_code_more_folders})'),
									wrap.span.path('/'),
									wrap.span.name('{help_code_option_name_color} 2'),
									wrap.code.custom('[green]'),
								'</code>',
							],
						], [
							'{help_code_option_inverted}:',
							[
								'<code>',
									wrap.span.nested(),
									wrap.code.sample('[not]'),
									wrap.span.name('{help_code_option_name_color} 1'),
									wrap.code.custom('[blue]'),
								'</code>',
							],
						], [
							'',
							[
								'<code>',
									wrap.span.ignore('...'),
								'</code>',
							],
						], [
							'{help_code_layer_to_recolor}:',
							[
								'<code>',
									wrap.span.name('{help_code_list_name_colors}'),
								'</code>',
							],
						],
					),
					getHelpSectionLinkHTML('help_color_value'),
				],
			}, {
				'code_sample' : [
					[
						'[colors]',
						wrap.span.name('{help_code_list_name_colors} 1, 2'),
						wrap.span.path('/'),
						wrap.span.name('{help_code_option_name_color} 1, 2'),
						wrap.code.custom('[red]'),
					],
				],
				'text_key' : 'add',
			}, {
				'code_sample' : [
					[
						'[colors]',
						wrap.span.name('{help_code_list_name_colors}'),
						wrap.span.path('/'),
						wrap.span.comment('({help_code_more_folders})'),
						wrap.span.path('/'),
						wrap.span.name('{help_code_option_name_color}'),
						wrap.code.custom('[green]'),
					],
				],
				'text_key' : 'nested',
			}, {
				'code_sample' : [
					[
						'[colors]',
						wrap.span.name('{help_code_list_name_colors}'),
						wrap.span.path('/'),
						wrap.code.sample('[if parts]'),
						wrap.span.name('{help_code_list_name_parts}'),
						wrap.span.path('/'),
						wrap.span.name('{help_code_option_name_part}'),
						wrap.span.path('/'),
						wrap.span.name('{help_code_option_name_color} 1'),
						wrap.code.custom('[blue]'),
					], [
						'[colors]',
						wrap.span.name('{help_code_list_name_colors}'),
						wrap.span.path('/'),
						wrap.code.sample('[not]'),
						wrap.span.name('{help_code_option_name_color} 1'),
						wrap.code.custom('[gray]'),
					], [
						'[colors]',
						wrap.span.name('{help_code_list_name_colors}'),
						wrap.span.path('/'),
						wrap.span.comment('({help_code_otherwise})'),
						wrap.span.name('{help_code_option_name_color} 1'),
						wrap.code.custom('[dark-blue]'),
					],
				],
				'text_key' : 'path_logic',
				'text_replace_values' : [
					wrap.code.param('[not]'),
					wrap.code.param('[if]'),
					getHelpSectionLinkHTML('help_path_logic'),
				],
			},
		],
		'opacity' : [
			{
				'text_key' : 'notes',
			}, {
				'code_sample' : getCodeColoredParamPercentages(
					['{help_code_list_name_opacity}', 'opacity='],
					['{help_code_list_name_opacity} 1, 2', ''],
				),
				'text_key' : 'set',
				'text_replace_values' : [
					wrap.code.param('[optional]'),
					getHelpSectionLinkHTML('help_other'),
				],
			},
		],
		'other' : [
			{
				'code_sample' : getCodeColoredParamWithListName(
					['optional ', 'parts', ''],
					['optional ', 'colors', ''],
					['optional ', 'zoom=25/50%'],
				),
				'text_key' : 'optional',
			}, {
				'code_sample' : getCodeColoredParamWithListName(
					['last ', 'parts', ''],
					['last ', 'colors', ''],
					['last ', 'zoom=25/50%'],
				),
				'text_key' : 'last',
			}, {
				'code_sample' : [
					[
						'[initial]',
						wrap.span.name('{help_code_option_name}'),
					], [
						'[preselect]',
						wrap.span.name('{help_code_option_name}'),
					], [
						wrap.span.sample('[parts]'),
						wrap.span.name('{help_code_list_name}'),
						wrap.span.path('/'),
						wrap.span.name('{help_code_option_name}'),
						'[preselect]',
					],
				],
				'text_key' : 'preselect',
			}, {
				'code_sample' : getCodeColoredParamWithListName(
					'prefix',
					'prefixed',
				),
				'text_key' : 'prefix',
				'text_replace_values' : getSaveFileNamingExample('"{filename_option_group}"'),
			}, {
				'code_sample' : getCodeColoredParamWithListName(
					'no-prefix',
					'unprefixed',
				),
				'text_key' : 'no_prefix',
				'text_replace_values' : getSaveFileNamingExample('"{filename_option}"'),
			}, {
				'code_sample' : '[no-render]',
				'text_key' : 'no_render',
			}, {
				'code_sample' : '[skip]',
				'text_key' : 'skip',
			},
		],
		'padding' : [
			{
				'text_key' : 'notes',
			}, {
				'code_sample' : getCodeColoredParamOutlineColorValue(
					'0px 1/2/3px (4,5,6)px',
					'(-1...1)/(5...10)px',
				),
				'text_key' : 'outer_radius',
				'text_replace_values' : wrap.code.param('/'),
			}, {
				'code_sample' : getCodeColoredParamOutline(
					'1:2px',
					'((0,1,2...5):(5...10))px',
				),
				'text_key' : 'inner_radius',
				'text_replace_values' : wrap.code.param(':'),
			}, {
				'code_sample' : getCodeColoredParamOutline('1x2px'),
				'text_key' : 'outer_box',
				'text_replace_values' : wrap.code.param('x'),
			}, {
				'code_sample' : getCodeColoredParamOutline('((1:2)x(3:4))px'),
				'text_key' : 'inner_box',
			}, {
				'code_sample' : getCodeColoredParamOutline(
					'1xpx',
					'(x1)px',
				),
				'text_key' : 'outer_square',
			}, {
				'code_sample' : getCodeColoredParamOutline(
					'1:xpx',
					'1x1:px',
					'x((-1...1):(-2...2))px',
				),
				'text_key' : 'inner_square',
			}, {
				'code_sample' : getCodeColoredParamOutline('1x2:3x4px'),
				'text_key' : 'invalid',
				'text_replace_values' : wrap.code.sample('1x2:3px'),
			}, {
				'code_sample' : getCodeColoredParamOutline(
					'at=0,1,2,' + wrap.span.custom('({help_code_more_numbers})'),
					'at=5...10',
				),
				'text_key' : 'threshold',
			//* TODO:
			// }, {
				// 'code_sample' : getCodeColoredParamOutline('max/min'),
				// 'text_key' : 'method',
			}, {
				'code_sample' : getCodeColoredParamOutline('at=0,5...10,16/(1...2):(3...4)x(5...6):(7...8)px'),
				'text_key' : 'cross',
				'text_replace_values' : [
					DEFAULT_ALPHA_MASK_PADDING,
					DEFAULT_ALPHA_MASK_THRESHOLD,
				],
			},
		],
		'param' : [
			{
				'text_key' : 'notes',
				'text_replace_values' : [
					getHelpSectionLinkHTML('help_virtual_path'),
					wrap.code.param('[ {help_param_params} ]'),
					wrap.code.comment('( {help_param_comments} )'),
					wrap.code.name('{help_param_names}'),
					wrap.code.path('/'),
					getTableHTML(
						[
							'1.',
							[
								'<code>',
									wrap.span.name(
										'{help_code_layer} 1, ',
										'{help_code_name} 2, ',
										'{help_code_name} 3, 4',
									),
									wrap.code.param(
										'[{help_code_param}1 ',
										'{help_code_param}2 ',
										'{help_code_param}3 4]',
									),
								'</code>',
							],
						], [
							'2.',
							[
								'<code>',
									wrap.code.param('[{help_code_param}1 {help_code_param}2]'),
									wrap.span.name('{help_code_layer} 1'),
									wrap.span.comment('({help_code_copy} 2)'),
									wrap.span.name('{help_code_name} 2'),
									wrap.code.param('[{help_code_param}3, 4]'),
									wrap.span.name('{help_code_name} 3, 4'),
									wrap.span.comment('({help_code_more_comments})'),
								'</code>',
							],
						],
					),
				],
			},
		],
		'parts' : [
			{
				'text_key' : 'notes',
				'text_replace_values' : [
					getTableHTML(
						[
							'{help_code_list_folder}:',
							[
								'<code>',
									wrap.span.folder(),
									wrap.code.param('[parts]'),
									wrap.span.name('{help_code_list_name_parts}'),
								'</code>',
							],
						], [
							'{help_code_option_layer}:',
							[
								'<code>',
									wrap.span.nested(),
									wrap.span.name('{help_code_option_name_part} 1'),
								'</code>',
							],
						], [
							'{help_code_option_folder}:',
							[
								'<code>',
									wrap.span.nested(),
									wrap.span.name('{help_code_option_name_part} 2'),
									wrap.span.path('/'),
									wrap.span.comment('({help_code_more_layers})'),
								'</code>',
							],
						], [
							'{help_code_option_inverted}:',
							[
								'<code>',
									wrap.span.nested(),
									wrap.code.sample('[not]'),
									wrap.span.name('{help_code_option_name_part} 1'),
								'</code>',
							],
						],
					),
				],
			}, {
				'code_sample' : [
					[
						'[parts]',
						wrap.span.name('{help_code_list_name_parts} 1, 2'),
						wrap.span.path('/'),
						wrap.span.name('{help_code_option_name_part} 1, 2'),
					],
				],
				'text_key' : 'add',
				'text_replace_values' : [
					wrap.code.param('[not]'),
					wrap.code.param('[if]'),
					getHelpSectionLinkHTML('help_path_logic'),
				],
			},
		],
		'path_logic' : [
			{
				'text_key' : 'notes',
				'text_replace_values' : wrap.code.param('[if]'),
			}, {
				'code_sample' : getCodeColoredParamParts(),
				'text_key' : 'if',
			}, {
				'code_sample' : getCodeColoredParamParts('', '[not]'),
				'text_key' : 'if_not_option',
			}, {
				'code_sample' : getCodeColoredParamParts('not '),
				'text_key' : 'if_not_list',
				'text_replace_values' : wrap.code.param('[not]'),
			}, {
				'code_sample' : getCodeColoredParamParts('not ', '[not]'),
				'text_key' : 'if_not_both',
				'text_replace_values' : wrap.code.param('[not]'),
			}, {
				'code_sample' : getCodeColoredParamPartsAny('', 'not '),
				'text_key' : 'if_any',
			}, {
				'code_sample' : getCodeColoredParamPartsAny('not '),
				'text_key' : 'if_not_any',
				'text_replace_values' : wrap.code.param('[not]'),
			}, {
				'code_sample' : '[not]',
				'text_key' : 'not',
				'text_replace_values' : [
					wrap.code.param('[if]'),
					wrap.code.param('[any]'),
				],
			}, {
				'code_sample' : '[any]',
				'text_key' : 'any',
				'text_replace_values' : wrap.code.param('[if]'),
			}, {
				'code_sample' : '[none]',
				'text_key' : 'none',
			},
		],
		'separate' : [
			{
				'text_key' : 'notes',
			}, {
				'code_sample' : '[separate]',
				'text_key' : 'global',
			}, {
				'code_sample' : getCodeColoredParamAlias('separate='),
				'text_key' : 'alias_id',
				'text_replace_values' : '{help_code_alias}',
			}, {
				'code_sample' : getCodeColoredParamAlias('separate-equal='),
				'text_key' : 'equal',
				'text_replace_values' : getSaveFileNamingExample('"{separate_naming_equal}"'),
			}, {
				'code_sample' : getCodeColoredParamAlias('separate-numbered='),
				'text_key' : 'numbered',
				'text_replace_values' : getSaveFileNamingExample('"{separate_naming_numbered}"'),
			}, {
				'code_sample': [
					wrap.span.name('{help_code_separate_group_name}') + '[separated]',
					wrap.span.name('{help_code_separate_group_name}') + '[separate-equal]',
					wrap.span.name('{help_code_separate_group_name}') + '[separate-numbered]',
				],
				'text_key' : 'layer_names',
			}, {
				'code_sample' : [
					'[separate=]',
				],
				'text_key' : 'empty_id',
			},
		],
		'side' : [
			{
				'text_key' : 'notes',
			}, {
				'code_sample' : [
					'[front]',
					'[not back]',
					'[if not reverse]',
				],
				'text_key' : 'front',
			}, {
				'code_sample' : [
					'[back]',
					'[not front]',
					'[if reverse]',
				],
				'text_key' : 'back',
			}, {
				'code_sample' : [
					'[reverse]' + wrap.span.comment('({help_code_folder})'),
				],
				'text_key' : 'reverse',
			}, {
				'code_sample' : '[reverse=' + wrap.span.sample('hor') + ']',
				'text_key' : 'flip_hor',
				'text_replace_values' : wrap.code.param('reverse'),
			}, {
				'code_sample' : '[reverse=' + wrap.span.sample('ver') + ']',
				'text_key' : 'flip_ver',
				'text_replace_values' : wrap.code.param('reverse'),
			},
		],
		'virtual_path' : [
			{
				'text_key' : 'notes',
				'text_replace_values' : [
					[
						[
							'{help_code_layer}:&nbsp;',
							'<code>',
								wrap.span.name('{help_code_parent_name}'),
								wrap.code.param('[{help_code_parent_param}]'),
								wrap.span.path('/'),
								wrap.span.name('{help_code_child_name}'),
								wrap.code.param('[{help_code_child_param}]'),
							'</code>',
						],
					],
					getTableHTML(
						[
							'{help_code_folder}:',
							[
								'<code>',
									wrap.span.folder(),
									wrap.span.name('{help_code_parent_name}'),
									wrap.code.param('[{help_code_parent_param}]'),
								'</code>',
							],
						], [
							'{help_code_layer}:',
							[
								'<code>',
									wrap.span.nested(),
									wrap.span.name('{help_code_child_name}'),
									wrap.code.param('[{help_code_child_param}]'),
								'</code>',
							],
						],
					),
					getHelpSectionLinkHTML('help_clone'),
				],
			},
		],
		'zoom' : [
			{
				'code_sample' : getCodeColoredParamPercentages(
					'zoom=',
					'x',
				),
				'text_key' : 'notes',
				'text_replace_values' : [
					wrap.code.param('[optional]'),
					getHelpSectionLinkHTML('help_other'),
				],
			},
		],
	};

	function getHeaderWithToggleButtons(toggleName, sectionName) {
	let	content;

		if (
			sectionName
		&&	(content = getLocalizedText(sectionName))
		) {
			return (
				'<header onclick="toggleSection(this)" id="'
			+		encodeTagAttr('top-menu-' + sectionName)
			+	'">'
			+		getTableHTML(content)
					.replace('<tr', '<tr class="left-arrow right-arrow"')
					.replace('<td', '<td class="section-link"')
			+	'</header>'
			);
		} else {
			content = OPEN_CLOSE.map(
				(actionName) => {
				const	buttonName = actionName + '_' + toggleName;

					return (
						'<button onclick="return toggleSection(this)" name="'
					+		encodeTagAttr(buttonName)
					+	'" id="'
					+		encodeTagAttr('top-menu-' + sectionName)
					+	'">'
					+		getLocalizedText(buttonName)
					+	'</button>'
					);
				}
			).join('</td><td>')

			return (
				'<header>'
			+		getTableHTML(content)
			+	'</header>'
			);
		}
	}

const	menuHTMLpartsOrder = [
		'param',
		'parts',
		'colors',
		'opacity',
		'padding',
		'side',
		'zoom',
		'separate',
		'autocrop',
		'collage',
		'batch',
		'clone',
		'virtual_path',
		'path_logic',
		'color_value',
		'other',
	];

	menuHTMLparts.help = getNestedFilteredArrayJoinedText([
		getHeaderWithToggleButtons('all_sections')
	,	menuHTMLpartsOrder.map(
			(sectionName) => {
			const	content = helpSections[sectionName];
			const	sectionContentHTML = getNestedFilteredArrayJoinedText(
					!isArray(content)
					? (
						content
					||	getLocalizedHTML('help_' + sectionName + '_content')
					)
					: content.map(
						(entry) => [
							(
								!entry.code_sample
								? '' :
								(
									'<pre class="' + (entry.code_class || 'param') + '">'
								+		getLocalizedHTML(entry.code_sample)
								+	'</pre>'
								)
							)
						,	(
								!entry.text_key
								? '' :
								(entry.text_key === 'todo')
								? todoHTML :
								(
									getLocalizedHTML(
										'help_' + sectionName + '_' + entry.text_key
									,	...asArray(entry.text_replace_values)
									).replace(regTrimTailBrTags, '')
								+	'<br>'
								)
							)
						]
					)
				);

				return (
					'<section>'
				+		getHeaderWithToggleButtons('section', 'help_' + sectionName)
				+		'<div class="hidden">'
				+			sectionContentHTML
				+		'</div>'
				+	'</section>'
				);
			}
		)
	]);

	console.timeEnd(logLabel);

	logLabel = 'Init menu: about';
	console.time(logLabel);

const	aboutLinks = [
		{
			'content' : getLocalizedHTML('about_notes')
		}
	,	{
			'pretext' : '<hr>'
		,	'header' : getLocalizedHTML('about_source')
		,	'links' : [
				['https://github.com/f2d/sprite_dress_up', 'GitHub']
			]
		}
	,	{
			'header' : getLocalizedHTML('about_lang')
		,	'links' : (
				getAllByTag('link')
				.filter(
					(element) => (
						element.getAttribute('rel') === 'alternate'
					&&	element.getAttribute('href')
					&&	element.getAttribute('hreflang')
					)
				).map(
					(element) => [
						element.getAttribute('href')
					,	element.getAttribute('hreflang').toUpperCase()
					]
				)
			)
		}
	];

	menuHTMLparts.about = getNestedFilteredArrayJoinedText(
		aboutLinks.map(
			(entry) => (
				(entry.pretext || '')
			+	'<p>'
			+	(!entry.header ? '' : entry.header + ':<br>')
			+	(!entry.lines ? '' : entry.lines.join('<br>'))
			+	getNestedFilteredArrayJoinedText(
					!entry.links ? '' : entry.links.map(
						([ url, text ]) => (
							'<a href="'
						+		encodeTagAttr(url)
						+	(
								url.includes('//')
								? '" class="external-link'
								: '" class="local-link'
							)
						+	'">'
						+		text
						+	'</a>'
						)
					)
				,	', '
				)
			+	(entry.content || '')
			+	'</p>'
			)
		)
	);

	console.timeEnd(logLabel);

	logLabel = 'Init GUI content';
	console.time(logLabel);

const	menuHTML = getNestedFilteredArrayJoinedText(
		Object.entries(menuHTMLparts).map(
			([ menuName, menuHTMLpart ]) => getDropdownMenuHTML(
				getLocalizedOrEmptyText(menuName) || todoText
			,	menuHTMLpart || todoHTML
			,	'top-menu-' + menuName
			)
		)
	);

const	toggleFixedTabWidthHTML = (
		'<button class="fixed-tab-width-button" onclick="return toggleFixedTabWidth()"'
	+		getTagAttrIfNotEmpty('title', getLocalizedOrEmptyText('fixed_tab_width'))
	+	'>'
	+		'[&#x22EF;]'
	+	'</button>'
	);

const	toggleTextSizeHTML = (
		'<button class="larger-text-button" onclick="return toggleTextSize()"'
	+		getTagAttrIfNotEmpty('title', getLocalizedOrEmptyText('larger_text'))
	+	'>'
	+		'<big>'
	+			getLocalizedText('text_size_sample')
	+		'</big>'
	+		'&nbsp;'
	+		'<small>'
	+			getLocalizedText('text_size_sample')
	+		'</small>'
	+	'</button>'
	);

	document.body.innerHTML = (
		'<div class="menu-bar">'
	+		menuHTML
	+	'</div>'
	+	'<div class="main panel row wrap" id="loaded-files-selection"></div>'
	+	'<div class="main panel" id="loaded-files-view"></div>'
	+	'<div class="top-buttons">'
	+		toggleFixedTabWidthHTML
	+		toggleTextSizeHTML
	+	'</div>'
	);

	if (!getStyleValue(getAllByClass('panel')[0], 'gap')) {
		toggleClass(document.body, 'no-gap', 1);
	}

	for (const element of getAllByClass('thumbnail')) {

		if (!element.firstElementChild) {
			setImageSrc(element);
		}
	}

const	linkTooltips = [
		['section-link', 'help_section_link'],
		['local-link', 'page_version_link'],
		['external-link', 'external_link'],
	];

	for (const [ className, textKey ] of linkTooltips)
	for (const element of getAllByClass(className)) {

	const	url = element.getAttribute('href');
	const	title = decodeURI(getLocalizedText(textKey, url));

		element.setAttribute('title', title);
	}

	console.timeEnd(logLabel);

//* enable/disable main menu buttons:

	setWIPstate(false);

//* add global on-page events:
//* Notes:
//*	"drop" may not work without "dragover".
//*	"keypress" ignores Esc key in some modern browsers.

	addEventListeners(
		window
	,	{
			'beforeunload' : onBeforeUnload
		,	'dragover' :	onPageDragOver
		,	'drop' :	onPageDrop
		,	'keydown' :	onPageKeyDown
		,	'resize' :	onResize
		}
	);

//* open or restore state of UI parts:

let	oldSetting;

	if (
		(LS && (oldSetting = LS[LS_KEY_BIG_TEXT]))
		? !FALSY_STRINGS.includes(oldSetting)
		: START_WITH_BIG_TEXT
	) {
		toggleTextSize();
	}

	if (
		(LS && (oldSetting = LS[LS_KEY_FIXED_TAB_WIDTH]))
		? !FALSY_STRINGS.includes(oldSetting)
		: START_WITH_FIXED_TAB_WIDTH
	) {
		toggleFixedTabWidth();
	}

	if (START_WITH_OPEN_FIRST_MENU_TAB) {
		toggleClass(getAllByTag('header')[0], 'show', 1);

		updateDropdownMenuPositions();
	}

//* ready for user input:

	toggleClass(document.body, 'loading', -1);
	toggleClass(document.body, 'ready', 1);

	if (USE_CONSOLE_LOG_GROUPING) console.groupEnd(logLabelWrap);
	console.timeEnd(logLabelWrap);

	logTime('Init: ready to work.');
}

//* Runtime *------------------------------------------------------------------

if (typeof loadScriptOrFallback !== 'function') {
	document.addEventListener('DOMContentLoaded', initUI, false);
}
