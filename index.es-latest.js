
'use strict';

//* TODO ---------------------- source file data: -----------------------------
//* TODO: keep all layer-name parameters single-word if possible.
//* TODO: whole config in JSON-format?
//* TODO: keep layer images as PNGs, create arrays for high-precision blending on demand, discard arrays when HQ mode is disabled.

//* TODO ---------------------- menu: -----------------------------------------
//* TODO: checkbox (on project selection bar?) to sync all option/export actions in selected project onto all opened projects where possible.
//* TODO: zoom format in filenames: [x1, x1.00, x100%].
//* TODO: options menu: add/remove/copy/edit colors and outlines, or all list(s), maybe in textarea.
//* TODO: remember already calculated batch counts and valid lists per project, in a dict with keys like joined list of all options and checkboxes.
//* TODO: <select multiple> <optgroup> <option>?</option> </optgroup> </select>.
//* TODO: save opened project as restructured ORA/PSD. Try https://github.com/Agamnentzar/ag-psd
//* TODO: save rendered image as WebP. https://bugs.chromium.org/p/chromium/issues/detail?id=170565#c77 - toDataURL/toBlob quality 1.0 = lossless.

//* TODO ---------------------- rendering: ------------------------------------
//* TODO: properly check copypaste visibility.
//* TODO: stop images moving to hidden container when save collage button was clicked.
//* TODO: fix hiding of clipping group with skipped/invisible/empty base layer.
//* TODO: keep track of current root of (possibly nested) copy-pasted layer (in array property with push-pop?) while rendering.
//* TODO: arithmetic emulation of all blending operations, not native to JS.
//* TODO: arithmetic emulation of all operations in 16/32-bit until final result; to be optionally available as checkbox/selectbox.
//* TODO: set RGB of zero-alpha pixels to average of all non-zero-alpha neighbour RGB values ignoring alpha.
//* TODO: for files without merged image data - render ignoring options, but respecting layer visibility properties. Or buttons to show embedded and/or rendered image regardless of options. Or add this as top-most option for any project, with or without options.
//* TODO: revoke collage blob urls when cleaning view container?
//* TODO: revoke any image blob urls right after image element's loading, without ever tracking/listing them?

//* TODO ---------------------- other: ----------------------------------------
//* TODO: store (in)validated combination in a Map by filename as key, and combinations to render (each wrapped in object as pointer to Map element and the filename) in a Set.
//* TODO: find zoom/scale of the screen/page before regenerating thumbnails.
//* TODO: consistent UI colors (what blue, yellow, white, etc. means across the whole page).
//* TODO: global job list for WIP cancelling instead of spaghetti-coded flag checks.
//* TODO: split JS files in a way that lets older browsers to use parts they can parse and execute (only show menu, or only load ORA, etc.).
//* TODO: split functionality into modules to reuse with drawpad, etc.

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

,	PREVIEW_SIZE = 80
,	THUMBNAIL_SIZE = 20
,	ZOOM_STEP_MAX_FACTOR = 2

//* If set to 0, use common setting from above:

,	TAB_PREVIEW_SIZE = 0
,	TAB_THUMBNAIL_SIZE = 0
,	TAB_ZOOM_STEP_MAX_FACTOR = 0	//* <- scaling in one step is blocky, stepping by factor of 2 is blurry, 4 may be okay for 20px and less.

,	ADD_COUNT_ON_BUTTON_LABEL	= false	//* <- if not, add separate text element.
,	ADD_PAUSE_AT_INTERVALS		= true	//* <- let UI update when loading files, rendering images, counting batch combinations, etc.
,	ADD_PAUSE_BEFORE_EACH_FOLDER	= false	//* <- can take ~1-5x longer than pause at intervals, but UI response is not very good.
,	ADD_PAUSE_BEFORE_EACH_LAYER	= false	//* <- can take ~1.5-2x longer than pause at folders, but UI response does not improve much.
,	ASK_BEFORE_EXIT_IF_OPENED_FILES	= true	//* <- this is annoying and would not be needed if big files could load fast.
,	CACHE_UNALTERABLE_FOLDERS_MERGED	= true	//* <- not much opportunity if almost everything is recolored or passthrough.
,	CACHE_UNALTERABLE_IMAGES_TRIMMED	= false	//* <- images are compressed faster by canvas API, when stored as PNG.
,	DOWNSCALE_BY_MAX_FACTOR_FIRST	= true	//* <- other way (starting with partial factor) is not better, probably worse.
,	EXAMPLE_NOTICE			= false	//* <- show the warning near the list of files.
,	FILE_NAME_ADD_PARAM_KEY		= true
,	GET_LAYER_IMAGE_FROM_BITMAP	= true
,	LOCALIZED_CASE_BY_CROSS_COUNT	= false	//* <- determine word case by product of all numbers in args; if not, then by the last number.
,	OPEN_FIRST_MENU_TAB_AT_START	= true
,	PRELOAD_ALL_LAYER_IMAGES	= false
,	PRELOAD_USED_LAYER_IMAGES	= false
,	READ_FILE_CONTENT_TO_GET_TYPE	= false	//* <- this relies on the browser or the OS to magically determine file type.
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
	;

//* ---------------------------------------------------------------------------
//* Create type-checking functions, e.g. "isString()" or "isImageElement()":
//* source: https://stackoverflow.com/a/17772086
[
	// 'AsyncFunction',	//* <- it maybe better to get just 'Function' from end to match this
	'Promise',
	'ArrayBuffer',
	'Array',
	'Date',
	'Function',
	'ImageData',
	'Number',
	'RegExp',
	'String',
	'HTMLCanvasElement',
	'HTMLImageElement',
	'HTMLSelectElement',
].forEach(
	function (typeName) {
		window[
			'is' + typeName.replace('HTML', '')
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

	? (array, maxDepth) => Array.prototype.flat.call(array, isNaN(maxDepth) ? Infinity : maxDepth)

//* legacy way:

	: (array, maxDepth) => {
		if (isNaN(maxDepth)) {
			maxDepth = Infinity;
		}

	const	flatArray = [];

		Array.from(array).forEach(
			(value) => {
				if (isArray(value)) {
					if (maxDepth > 0) {
						flatArray.concat(getFlatArray(value, maxDepth - 1))
					} else {
						flatArray.concat(value)
					}
				} else {
					flatArray.push(value)
				}
			}
		);

		return flatArray;
	}
);

//* Config: internal, do not change *------------------------------------------

const	CONFIG_FILE_PATH = 'config.js'			//* <- declarations-only file to redefine any of the above variables
,	FETCH_TEST_FILE_PATH = 'index.png'		//* <- smallest local file to test loading from disk
,	LS_NAMESPACE = 'spriteDressUp'
,	LS_KEY_BIG_TEXT = LS_NAMESPACE + 'BigText'

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
		'skip':		/^(skip)$/i
	,	'skip_render':	/^(skip|no)\W+(render)$/i
	,	'check_order':	/^(?:check\W+)?(?:top|bottom\W+)?(down|up)$/i
	,	'none':		/^(none)$/i
	,	'if_only':	/^(if|in)$/i
	,	'not':		/^(\!|not?)$/i
	,	'any':		/^(\?|any|some)$/i

	,	'copypaste':	/^(copy|paste)(?:\W(.*))?$/i
	,	'color_code':	regColorCode

	,	'colors':	/^(colou?r)s$/i
	,	'parts':	/^(option|part|type)s$/i

	,	'paddings':	/^(outline|pad[ding]*)$/i
	,	'radius':	/^(.*?\d.*)px(?:\W(.*))?$/i
	// ,	'wireframe':	/^(?:wire\W*)?(frame|fill)$/i

	,	'opacities':	/^(?:(?:opacit[yies]*)\W*)?(\d[^%]*)%(\d*)$/i
	,	'zoom':		/^(?:(?:zoom|scale|x)\W*)(\d[^%]*)%(\d*)$/i

	,	'side':		/^(front|back|reverse(?:\W(.*))?)$/i
	,	'separate':	/^(separate|split)$/i

	,	'autocrop':	/^(autocrop)(?:\W(.*))?$/i
	,	'collage':	/^(collage)(?:\W(.*))?$/i
	,	'layout':	/^(inline|newline|rows|columns)$/i

	,	'multi_select':	/^(optional|x(\d[\d+-]*))$/i
	,	'preselect':	/^(preselect|initial|last)$/i
	,	'batch':	/^(batch|no-batch|single)?$/i

	,	'no_prefix':	/^(no-prefix)$/i
	}

,	regLayerBlendModePass	= /^pass[-through]*$/i
,	regLayerBlendModeAlpha	= /^(source|destination)-(\w+)$/i
,	regLayerTypeSingleTrim	= /s+$/i
,	regHasDigit		= /\d/
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

,	regJSONstringify = {
		asFlatLine	: /^(data)$/i
	,	asFlatLines	: /^(layers)$/i
	,	skipByKey	: /^(channels|parent|sourceData)$/i
	,	skipByKeyIfLong	: /^(imageData)$/i
	,	showFromTree	: /^(layers|name)$/i
	}

const	SPLIT_SEC = 60
,	MIN_CHANNEL_VALUE = 0
,	MAX_CHANNEL_VALUE = 255
,	MAX_OPACITY = 255
,	MAX_BATCH_PRECOUNT = 9999

,	FLAG_FLIP_HORIZONTAL = 1
,	FLAG_FLIP_VERTICAL = 2

,	FLAG_EVENT_STOP_IMMEDIATE = {stopImmediatePropagation: true}
,	FLAG_EVENT_NO_DEFAULT = {preventDefault: true}

,	DUMMY_ARRAY = [null]	//* <- for cross-product combinations

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

,	BLOB_PREFIX = 'blob:'
,	DATA_PREFIX = 'data:'
,	TYPE_TEXT = 'text/plain'
,	TITLE_LINE_BREAK = ' \r\n'

,	TIME_PARTS_YMD = ['FullYear', 'Month', 'Date']
,	TIME_PARTS_HMS = ['Hours', 'Minutes', 'Seconds']

,	QUERY_SELECTOR = {
		getElementsByClassName:	['.', ''],
		getElementsByTagName:	['', ''],
		getElementsByName:	['*[name="', '"]'],
		getElementsByType:	['*[type="', '"]'],
		getElementsById:	['*[id="', '"]'],
	}

,	BLEND_MODE_NORMAL = 'source-over'
,	BLEND_MODE_CLIP = 'source-atop'
,	BLEND_MODE_MASK = 'destination-in'
,	BLEND_MODE_CUT = 'destination-out'
,	BLEND_MODE_INVERT = 'source-out'
,	BLEND_MODE_ADD = 'lighter'
,	BLEND_MODE_PASS = 'pass'
,	BLEND_MODE_TRANSIT = 'transition'

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
		'normal':	BLEND_MODE_NORMAL
	,	'add':		BLEND_MODE_ADD
	,	'plus':		BLEND_MODE_ADD
	,	'linear-dodge':	BLEND_MODE_ADD

//* from SAI2, remap according to PSD.js:

	,	'burn':		'color-burn'
	,	'burn-dodge':	'vivid-light'
	,	'darken-color':	'darker-color'
	,	'dodge':	'color-dodge'
	,	'exclude':	'exclusion'
	,	'lighten-color':'lighter-color'
	,	'shade':	'linear-burn'
	,	'shade-shine':	'linear-light'
	,	'shine':	BLEND_MODE_ADD
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

//* taken from PSDLIB.js:

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
,	PARAM_KEYWORDS_SET_VALUE_TO_TRUE = ['last', 'no_prefix']
,	PARAM_KEYWORDS_SHORTCUT_FOR_ALL = ['all', 'etc']
,	PARAM_OPTIONS_FOR_EACH_NAME = ['opacities', 'paddings']
,	PARAM_OPTIONS_GLOBAL = ['autocrop', 'collage', 'separate', 'side', 'zoom']
,	PARAM_OPTIONS_LOCAL = ['parts', 'colors', 'paddings', 'opacities']
,	VIEW_SIDES = ['front', 'back']

,	NAME_PARTS_PERCENTAGES = ['zoom', 'opacities']
,	NAME_PARTS_FOLDERS = ['parts', 'colors']
,	NAME_PARTS_ORDER = ['parts', 'colors', 'paddings', 'opacities', 'side', 'separate', 'zoom', 'autocrop']
,	NAME_PARTS_SEPARATOR = ''

,	PARAM_OPTIONS_ADD_BY_DEFAULT = {
		'collage':  ['optional', 'collage',  'no-batch', 'last']
	,	'autocrop': ['optional', 'autocrop', 'no-batch', 'last']
	}

,	SWITCH_CLASS_BY_INDEX = ['unchecked', 'checked']
,	SWITCH_CLASS_BY_TYPE = {
		'batch': ['single', 'all']
	,	'layout': ['inline', 'newline']
	}

,	SWITCH_NAMES_BY_TYPE = {
		'batch': ['single', 'batch']
	,	'layout': ['inline', 'newline']
	}

,	SWITCH_NAMES_DEFAULT = {
		'batch': 'batch'
	,	'layout': 'inline'
	}

,	PROJECT_OPTION_GROUPS = [
		{
			'header': 'option_header_collage',
			'select': {
				'collage': {
					'align': 'option_collage_align',
					'background': 'option_collage_background',
					'border': 'option_collage_border',
					'padding': 'option_collage_padding',
				},
			},
		},
		{
			'header': 'option_header_view',
			'select': {
				'autocrop': 'option_autocrop',
				'zoom': 'option_zoom',
				'side': 'option_side',
				'separate': 'option_separate',
			},
		},
		{
			'parts': 'option_header_parts',
			'opacities': 'option_header_opacities',
			'paddings': 'option_header_paddings',
			'colors': 'option_header_colors',
		},
	]

,	EXAMPLE_CONTROLS = [
		{
			'download_all': 'download_all',
			'load_all': 'open_example_all',
		},
		{
			'stop': 'stop',
		},
	]

,	PROJECT_FILE_CONTROLS = [
		'show_project_details',
		// 'save_ora',
	]

,	PROJECT_VIEW_CONTROLS = [
		{
			'header': 'reset_header',
			'buttons': {
				'reset_to_init': 'reset_to_init',
				'reset_to_top': 'reset_to_top',
				'reset_to_bottom': 'reset_to_bottom',
				'reset_to_empty': 'reset_to_empty',
			},
		},
		{
			'header': 'current_header',
			'buttons': {
				'show': 'show_png',
				'save': 'save_png',
			},
		},
		{
			'header': 'batch_header',
			'buttons': {
				'show': {
					'show_all': 'show_png_batch',
					'save_all': 'save_png_batch',
				},
				'save': {
					'show_join': 'show_png_collage',
					'save_join': 'save_png_collage',
				},
				'stop': 'stop',
			},
		},
	]

,	IMAGE_GEOMETRY_KEYS = [
		['top', 'y'],
		['left', 'x'],
		['width', 'w'],
		['height', 'h'],
	]

,	VIRTUAL_FOLDER_TAKEOVER_PROPERTIES = [
		['blendMode', BLEND_MODE_NORMAL],
		['isBlendModeTS', false],
		['isClipped', false],
	]

,	IMAGE_DATA_KEYS_TO_LOAD = [
		'toImage',
		'loadImage',
		'pixelData',
		'maskData',
		'imgData',
	]

,	CLEANUP_KEYS_TESTING = [
		'loading',
		// 'loadImage',	//* <- keep for lazy-loading
		'toPng',
	]

,	CLEANUP_KEYS = CLEANUP_KEYS_TESTING.concat([
		'blendModeOriginal',
		'nameOriginal',
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

,	thumbnailPlaceholder
,	isStopRequested
,	isBatchWIP
,	lastTimeProjectTabSelectedByUser = 0
	;

//* Config: internal, wrapped to be called after reading external config *-----

function initLibParams() {
	USE_WORKERS_IF_CAN = (USE_WORKERS && CAN_USE_WORKERS);

const	libCodecPNG = [USE_UPNG ? 'UPNG.js' : null];
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
		'zlib-asm': {

//* source: https://github.com/ukyo/zlib-asm

			'varName': 'zlib'
		,	'dir': ZLIB_ASM_DIR
		,	'files': ['zlib.js']
		},

		'pako': {

//* source: https://github.com/nodeca/pako

			'varName': 'pako'
		,	'dir': ZLIB_PAKO_DIR
		,	'files': [zlibPakoFileName]
		},

		'UZIP.js': {

//* source: https://github.com/photopea/UZIP.js

			'varName': 'UZIP'
		,	'dir': LIB_FORMATS_DIR + 'zlib/UZIP/'
		,	'files': ['UZIP.js']
		,	'depends': ['pako']
		},

		'UPNG.js': {

//* source: https://github.com/photopea/UPNG.js

			'varName': 'UPNG'
		,	'dir': LIB_FORMATS_DIR + 'png/UPNG/'
		,	'files': ['UPNG.js']
		,	'depends': zlibCodecPNG
		},

		'zip.js': {

//* source: https://github.com/gildas-lormeau/zip.js

			'varName': 'zip'
		,	'dir': ZIP_FORMAT_DIR
		,	'files': [
				'zip.js',
				'zip-fs.js',
			].concat(
				USE_WORKERS_IF_CAN
				? []
				:

//* CORS workaround: when not using Workers, include scripts here.
//* https://github.com/gildas-lormeau/zip.js/issues/169#issuecomment-312110395

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
		,	'depends': (
				USE_WORKERS_IF_CAN
			||	USE_ONE_FILE_ZIP_WORKER
			||	!USE_ZLIB_CODECS
				? []
				: [zlibCodecZIP]
			)
		},

		'ora.js': {

//* source: https://github.com/zsgalusz/ora.js

//* no support for ORA in CSP, SAI, etc.
//* not enough supported features in Krita, etc.

//* way: draw in SAI2 → export PSD → import PSD in Krita (loses clipping groups) → export ORA (loses opacity masks)
//* wish: draw in SAI2 → export ORA (all layers rasterized + all blending properties and modes included as attributes)

			'varName': 'ora'
		,	'dir': LIB_FORMATS_DIR + 'ora/ora_js/'
		,	'files': ['ora.js']
		,	'depends': ['zip.js']
		},

		'psd.js': {

//* source: https://github.com/meltingice/psd.js/issues/154#issuecomment-446279652
//* based on https://github.com/layervault/psd.rb

			'varName': 'PSD_JS'
		,	'dir': LIB_FORMATS_DIR + 'psd/psd_js/psd.js_build_by_rtf-const_2018-12-11/'	//* <- working with bigger files?
		,	'files': ['psd.js']
		,	'depends': libCodecPNG
		},

		'psd.browser.js': {

//* source: https://github.com/imcuttle/psd.js/tree/release
//* fork of https://github.com/meltingice/psd.js

			'varName': 'PSD'
		,	'dir': LIB_FORMATS_DIR + 'psd/psd_js/psd.js_fork_by_imcuttle_2018-09-19/'		//* <- working here
		,	'files': ['psd.browser.js']
		,	'depends': libCodecPNG
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
			'dropFileExts': ['ora', 'zip']
		,	'inputFileAcceptMimeTypes': ['image/openraster', 'application/zip']
		,	'handlerFuncs': [
				loadORA,
			]
		},
		{
			'dropFileExts': ['psd']
		,	'inputFileAcceptMimeTypes': ['image/x-photoshop', 'image/vnd.adobe.photoshop']
		,	'handlerFuncs': [
				loadPSD,
				// loadPSDBrowser,	//* <- second parser is only needed if it could success on different files
			]
		},
	];
}

//* Common utility functions *-------------------------------------------------

const asArray = (value) => ( isArray(value) ? value : [value] );

const toggleClass = (
	typeof document.documentElement.classList === 'undefined'

//* legacy way:

	? (element, className, keep) => {
	const	oldText = element.className || element.getAttribute('className') || '';
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
			element.removeAttribute('className');
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

//* source: https://stackoverflow.com/a/55896125
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

function getClassReg() {
	return (
		isRegExp(arguments[0])
		? arguments[0]
		: new RegExp('(^|\\s)(' + getFlatArray(arguments).join('|') + ')($|\\s)', 'i')
	);
}

/*
//* source: https://cwestblog.com/2011/05/02/cartesian-product-of-multiple-arrays/
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

			a.forEach(
				(a) => b.forEach(
					(b) => result.push(a.concat([b]))
				)
			);

			return result;
		}
	,	[[]]
	);
}

//* Shorter version, source: https://stackoverflow.com/a/43053803
const getCrossProductSub = (a, b) => [].concat(...a.map(d => b.map(e => [].concat(d, e))));
const getCrossProductArr = (a, b, ...c) => (b ? getCrossProductArr(getCrossProductSub(a, b), ...c) : a);

//* source: http://phrogz.net/lazy-cartesian-product
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

//* source: http://phrogz.net/lazy-cartesian-product
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

//* source: http://phrogz.net/lazy-cartesian-product
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

function arrayFilterUniqueValues(value, index, array) {return (array.indexOf(value) === index);}
function orz(value) {return parseInt(value||0)||0;}
function orzClamp(value, min, max) {return Math.max(min, Math.min(max, orz(value)));}
function orzFloat(value) {return parseFloat(value||.0)||.0;}
function orzTrim(value) {return orz(String(value).replace(regTrimNaN, ''));}

function getDistance(x,y) {return Math.sqrt(x*x + y*y);}
function getAlphaDataIndex(x,y, width) {return (((y*width + x) << 2) | 3);} // {return (((y*width + x) * 4) + 3);}
function repeatText(text, numberOfTimes) {return (new Array(numberOfTimes + 1)).join(text);}

function replaceAll(text, replaceWhat, replaceWith) {
	if (isArray(replaceWhat)) {
		Array.from(arguments).forEach(
			(arg) => {
				if (isArray(arg)) {
					text = replaceAll(text, ...arg);
				}
			}
		);

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
	String(newValuesText)
	.split(regCommaSpace)
	.forEach(
		(rangeText) => {
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
					for (let value = max; value >= min; value--) {
						addToListIfNotYet(values, value);
					}
				} else {
					for (let value = min; value <= max; value++) {
						addToListIfNotYet(values, value);
					}
				}

		//* don't forget overstepped floats:

				addToListIfNotYet(values, min);
				addToListIfNotYet(values, max);
			}
		}
	);

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
	return getNestedArrayJoinedText(value, {filter: true}, ...joinTexts);
}

function getNestedFilteredArrayEnclosedJoinedText(value, prefix, suffix, ...joinTexts) {
	return getNestedArrayJoinedText(value, {prefix, suffix, filter: true}, ...joinTexts);
}

function getNestedArrayJoinedText(value, flags, ...joinTexts) {
	if (!isNonNullObject(flags)) {
		flags = {};
	}

	if (!isArray(joinTexts) || !joinTexts.length) {
		joinTexts = [''];
	}

const	wrapText = {
		'prefix': '',
		'suffix': '',
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
					isNaN(arg)
					? result
					: (
						(
							isNaN(result)
							? 1
							: result
						) * arg
					)
				)
			,	undefined
			)
			: args.reduce(
				(result, arg) => (
					isNaN(arg)
					? result
					: arg
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

		for (const key in flags) if (
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

const	rgba = [0,0,0,255];

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
const	rgba = [0,0,0,255];

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
		||	rgba.some(
				(channelValue) => (channelValue > 0)
			)
		)
	);
}

function getNormalizedRGBA(rgba) {
	if (rgba.length > 3) {
		if (rgba[3] === 255) {
			return rgba.slice(0,3);
		}

		if (rgba[3] === 0) {
			return [0,0,0,0];
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

//* source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#Deep_Clone
function getPatchedObject(obj, jsonReplacerFunc) {
	return JSON.parse(JSON.stringify(obj, jsonReplacerFunc || null));
}

//* source: https://stackoverflow.com/a/53593328
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
	for (const obj of sources) if (
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
		Array.from(keysToRemove).forEach(
			(key) => {
				if (key in obj) {
					obj[key] = null;
					delete obj[key];
				}
			}
		);

		Array.from(childKeys).forEach(
			(key) => {
			const	child = obj[key];

				if (child) {
					if (child.forEach) {
						child.forEach((child) => cleanupObjectTree(child, childKeys, keysToRemove));
					} else {
						cleanupObjectTree(child, childKeys, keysToRemove);
					}
				}
			}
		);
	}

	return obj;
}

//* source: https://gist.github.com/wellcaffeinated/5399067#gistcomment-1364265
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
		) || [];

		return Array.prototype.slice.call(results);

	} catch (error) {
		logError(error, arguments);
	}

	return [];
}

function getAllByClass	(text, parent) {return getElementsArray('getElementsByClassName', text, parent);}
function getAllByTag	(text, parent) {return getElementsArray('getElementsByTagName', text, parent);}
function getAllByType	(text, parent) {return getElementsArray('getElementsByType', text, parent);}
function getAllByName	(text, parent) {return getElementsArray('getElementsByName', text, parent);}
function getAllById	(text, parent) {return getElementsArray('getElementsById', text, parent);}
function getOneById	(text) {return document.getElementById(text);}

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

//* propNameForIE:
function dashedToCamelCase(text) {
	return (
		String(text)
		.split('-')
		.map(
			(word, index) => (
				index === 0
				? word.toLowerCase()
				: word.slice(0,1).toUpperCase() + word.slice(1).toLowerCase()
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
	getAllByClass('menu-head', getThisOrParentByClass(element, regClassMenuBar)).forEach(
		(tabContainer) => {
		const	header = getAllByTag('header', tabContainer)[0];

			if (header && header !== element) {
				toggleClass(header, 'show', -1);
			}
		}
	);

	OPEN_FIRST_MENU_TAB_AT_START = false;
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
	let	header = null;

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
		getAllByTag('section', header.parentNode).forEach(
			(section) => toggleAllSections(getAllByTag('header', section)[0])
		);

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
		const	fromSection = getThisOrParentByTagName(sourceElement, 'section');
		const	toSection = getThisOrParentByTagName(header, 'section');

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

function toggleTextSize() {
const	isBigTextEnabled = toggleClass(document.body, 'larger-text');

	updateDropdownMenuPositions();

	if (LS) {
		LS[LS_KEY_BIG_TEXT] = isBigTextEnabled;
	}
}

function makeElementFitOnClick(element, initialState) {
	element.className = initialState || 'size-fit';
	element.setAttribute('onclick', 'toggleClass(this, \'size-fit\'), toggleClass(this, \'size-full\')');
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

	if (isNaN(x)) {
	let	offset = getOffsetXY(element);
		x = offset.x;
		y = offset.y;
	} else {
		x = orz(x) + parentOffsetX;
		y = orz(y) + parentOffsetY;
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

function getFileExt(name) {return name.split(/\./g).pop().toLowerCase();}
function getFileName(path) {return path.split(/\//g).pop();}
function getFilePathFromUrl(url) {return url.split(/\#/g).shift().split(/\?/g).shift();}
function getFormattedFileNamePart(name) {return (name ? '[' + name + ']' : '');}

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

function getTimeNow() {return +new Date();}
function getLogTime() {return getFormattedTime({logFormat: true});}

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
			typeof args === 'undefined'
			? [] : [
				// 'In function:', args.callee.name,	//* <- not available in strict mode
				'With arguments:', args,
			]
		).concat(
			typeof context === 'undefined'
			? [] : [
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

function getFilePromise(file, projectOrTab) {

//* Note: "file" may be a blob object.
//* source: https://stackoverflow.com/a/15981017

	if (
		!file
	||	typeof FileReader !== 'function'
	) {
		return null;
	}

	return new Promise(
		(resolve, reject) => {
		const	reader = new FileReader();

			if (projectOrTab) {
				reader.onloadstart =
				reader.onloadend =
				reader.onprogress = (evt) => updateProjectOperationProgress(
					projectOrTab
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

function getFilePromiseFromURL(url, responseType, projectOrTab) {

//* Note: "url" may be a "blob:" or "data:" url.
//* source: https://www.mwguy.com/decoding-a-png-image-in-javascript/

	if (
		!url
	||	typeof XMLHttpRequest !== 'function'
	) {
		return null;
	}

	return new Promise(
		(resolve, reject) => {
		const	request = new XMLHttpRequest();

			if (projectOrTab) {
				request.onloadstart =
				request.onloadend =
				request.onprogress = (evt) => updateProjectOperationProgress(
					projectOrTab
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

function getImageElementFromData(imageData) {
	if (isNonNullImageData(imageData)) {
	const	arrayBuffer = UPNG.encode(
			[imageData.data.buffer]	//* <- array of frames. A frame is an ArrayBuffer (RGBA, 8 bits per channel).
		,	imageData.width
		,	imageData.height
		);

	const	url = getBlobURLFromByteArray(arrayBuffer, 'image/png');
	const	img = cre('img', (TESTING_PNG ? document.body : null));
		img.src = url;

		if (TESTING_PNG) console.log('getImageElementFromData:', [imageData, arrayBuffer, url, img]);

		return new Promise(
			(resolve, reject) => resolvePromiseOnImgLoad(img, resolve, reject)
		).catch(catchPromiseError);
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
		if (blob) URL.revokeObjectURL(blob.url);
	}

	data = (
		isNonNullObject(data)
		? JSON.stringify(
			data
		,	jsonReplacerFunc || null
		,	'\t'
		)
		: String(data)
	);

let	dataURI = '';
let	type = TYPE_TEXT;
let	blob = false;

	if (hasPrefix(data, BLOB_PREFIX)) {
		dataURI = data;
		blob = true;
	} else
	if (hasPrefix(data, DATA_PREFIX)) {
		dataURI = data;
	} else {
		dataURI = DATA_PREFIX + type + ',' + encodeURIComponent(data);
	}

let	size = dataURI.length;

	logTime(
		[
			'saving "' + fileName + '"'
		,	'data size = ' + data.length + ' bytes'
		,
		].concat(
			blob
			? ['blob URI = ' + dataURI]
			: ['data URI size = ' + size + ' bytes']
		).join(', ')
	);

const	a = cre('a', document.body);

	if ('download' in a) {
		try {
			if (!blob) {
				if (blob = dataToBlob(data)) {
					size = blob.size;
					type = blob.type;
					dataURI = blob.url;
				} else {
					type = dataURI.split(';', 1)[0].split(':', 2)[1];
				}
				if (!ext) {
					ext = type.split('/').slice(-1)[0];
				}
			}
			if (ext === 'plain') ext = 'txt';

		const	time = (
				!fileName || addTime
				? getFormattedTime({fileNameFormat: true})
				: ''
			);

		const	baseName = (
				!fileName ? time
				: (addTime > 0) ? fileName + '_' + time
				: (addTime < 0) ? time + '_' + fileName
				: fileName
			);

			fileName = baseName + (ext ? '.' + ext : '');

			a.onclick = cleanUpAfterDL;	//* <- https://stackoverflow.com/a/26643754
			a.download = fileName;
			a.href = String(dataURI);
			a.click();

			logTime('saving "' + fileName + '"');
		} catch (error) {
			logError(error, arguments);
		}
	} else {
		window.open(dataURI, '_blank');

		logTime('opened file to save');
	}

	if (a) setTimeout(
		cleanUpAfterDL
	,	Math.max(Math.ceil(size / 1000), 12345)
	);

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
					scripts = lib.files || lib;

					if (isArray(scripts)) {
						scripts = getFlatArray(scripts);
					} else {
						scripts = [scripts];
					}

					addNextScript();
				} else {
					resolve(true);
				}
			}

			addNextScript();
		}
	).catch(catchPromiseError);
}

async function loadLibOnDemandPromise(libName) {
	if (!libName) {
		return false;
	}

const	lib = FILE_TYPE_LIBS[libName] || {};

	if (!lib) {
		return false;
	}

const	varName = lib.varName || '';

	if (varName && window[varName]) {
		return true;
	}

const	dir = lib.dir || '';
const	scripts = Array.from(lib.files || []);

	if (!scripts.length) {
		return false;
	}

const	depends = lib.depends || null;

	if (depends) {
		for (const name of asArray(depends)) if (name) {
			if (! await loadLibOnDemandPromise(name)) {
				return false;
			}
		}
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
//* source: http://gildas-lormeau.github.io/zip.js/core-api.html#alternative-codecs

							if (ZIP_WORKER_SCRIPTS) {
								zip.workerScripts = {
									deflater: ZIP_WORKER_SCRIPTS,
									inflater: ZIP_WORKER_SCRIPTS,
								};
							} else {
								zip.workerScriptsPath = dir;
							}
						}
					}

					if (varName === 'ora') {
						ora.preloadImages = false;
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

			let	scriptSrc = null;

				while (scripts.length > 0) if (scriptSrc = scripts.shift()) {
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

function getProjectContainer(element) {return getTargetParentByClass(element, regClassLoadedFile);}
function getProjectButton(element) {return getTargetParentByClass(element, regClassButton);}

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

function getResizedCanvasFromImg(img, w,h) {
const	canvas = cre('canvas');
const	ctx = canvas.getContext('2d');
const	widthFrom  = img.width;
const	heightFrom = img.height;

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
	if (isNonNullImageData(imageData)) {
	const	canvas = cre('canvas');
	const	ctx = canvas.getContext('2d');
	const	{data, width, height} = imageData;

		canvas.width = width;
		canvas.height = height;

		if (!isImageData(imageData)) {
			imageData = new ImageData(width, height);
			imageData.data.set(data);
		}


		ctx.putImageData(imageData, 0,0);

		return canvas;
	}

	if (TESTING > 2) console.error('getCanvasFromImageData failed:', arguments);
}

function getImageData(img, x,y, w,h) {
let	ctx = null;

	if (isCanvasElement(img)) {
	const	canvas = img;
		ctx = canvas.getContext('2d');

		x = orz(x);
		y = orz(y);
		w = orz(w) || (canvas.width  - x);
		h = orz(h) || (canvas.height - y);
	} else
	if (isImageElement(img)) {
	const	canvas = cre('canvas');
		ctx = canvas.getContext('2d');

		canvas.width  = w = orz(w || img.width)  - orz(x);
		canvas.height = h = orz(h || img.height) - orz(y);
		x = 0;
		y = 0;

		ctx.drawImage(img, x,y);
	}

	if (ctx) {
		return ctx.getImageData(x,y, w,h);
	}
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

function getFirstPixelRGBA(img) {
	if (isImageElement(img)) {
		img = getImageData(img, 0,0, 1,1).data;
	}

	if (img && img.slice) {
		return img.slice(0,4);
	}
}

function getAutoCropArea(img, bgToCheck) {
	if (!isNonNullImageData(img = getImageData(img))) {
		return;
	}

const	data = img.data;
const	totalBytes = data.length;
const	w = img.width;
const	h = img.height;
const	horizontalBytes = w << 2;

let	bgRGBA = null;
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
			const	index = bgToCheck.length;

				bgRGBA = (
					index >= 4
					? bgToCheck.slice(0,4)
					: bgToCheck.concat([0,0,0,255].slice(index))
				);
			}
		}
	}

	bgRGBA = (
		bgRGBA
		? Array.from(bgRGBA)
		: [0,0,0,0]
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
		for (let index = 0; index < totalBytes; index++) {
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
		'left': foundLeft
	,	'right': foundRight

	,	'top': foundTop
	,	'bottom': foundBottom

	,	'width': foundWidth
	,	'height': foundHeight
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
	addButton(container, getLocalizedText(label || name)).name = name || label;
}

function addButtonGroup(container, group) {

	for (const buttonName in group) {
	const	entry = group[buttonName];

		if (isString(entry)) {
			addNamedButton(container, buttonName, entry);
		} else
		if (isNonNullObject(entry)) {
			addButtonGroup(cre('div', container), entry);
		}
	}
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

function getNormalizedBlendMode(text) {
const	blendMode = String(text).toLowerCase();
let	replaced;

	return (
		BLEND_MODES_REMAP[blendMode]
	||	BLEND_MODES_REMAP[
			replaced = trim(
				BLEND_MODES_REPLACE.reduce(
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

function getLayerPath(layer, flags) {
	if (!layer) {
		return [];
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
	return getLayerPath(layer, {includeSelf: true, asText: true});
}

function getLayerVisibilityChain(layer) {
const	layers = [];

	while (layer) {
		layers.push(layer);

		layer = layer.clippingLayer || getParentLayer(layer);
	}

	return layers.reverse();
}

function getLayersTopSeparated(layers) {
let	layersToRender = [];

	while (
		isArray(layers)
	&&	layers.length > 0
	) {
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
	return !(
		layer.params.skip
	||	layer.params.skip_render
	||	(layer.clippingLayer && !isLayerRendered(layer.clippingLayer))
	);
}

function isLayerSkipped(layer) {
	if (TESTING && !layer.params) {
		console.error('No params:', [layer, getLayerPathText(layer)]);
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
	||	IMAGE_DATA_KEYS_TO_LOAD.some((key) => key in layer)
	||	(
			layer.mask
		&&	IMAGE_DATA_KEYS_TO_LOAD.some((key) => key in layer.mask)
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
				data: getPropByAnyOfNamesChain(pixelData, 'data')
			,	width: getPropFromAnySource('width', pixelData, target, node)
			,	height: getPropFromAnySource('height', pixelData, target, node)
			};

			if (
				USE_UPNG
			&&	(img = await getImageElementFromData(imgData))
			) {
				return img;
			}

		const	canvas = getCanvasFromImageData(imgData);

			if (
				canvas
			&&	(img = await getImagePromiseFromCanvasToBlob(canvas, project))
			) {
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
			of [
				target.sourceData
			,	target
			]
		) if (isNonNullObject(sourceOrTarget))
		for (
			const mergedOrNode
			of [
				sourceOrTarget.mergedImage
			,	sourceOrTarget.prerendered
			,	sourceOrTarget.thumbnail
			,	sourceOrTarget
			]
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
				if (layer.top)  img.top  = layer.top;
				if (layer.left) img.left = layer.left;

				layer.img = img;
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

	if (OPEN_FIRST_MENU_TAB_AT_START) {
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
	buttonFileName.textContent = sourceFile.name;

let	buttonStatus;

	if (TAB_STATUS_TEXT) {
		buttonStatus = cre('div', buttonText);
		buttonStatus.className = 'button-status';
	}

const	buttonClose = cre('div', buttonTab);
	buttonClose.className = 'button-close';

	buttonClose.setAttribute('onclick', 'closeProject(this)');

	setImageSrc(imgThumb);

const	projectButtons = {
		buttonTab,
		buttonText,
		buttonStatus,
		imgThumb,
		errorParams: sourceFile.ext,
		errorPossible: 'project_status_error_file_type',
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
		const	childKeys = ['layers'];

			cleanupObjectTree(
				project
			,	childKeys
			,	(
					TESTING > 1
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
				if (result = await updateMenuAndShowImg(project)) {
					await updateBatchCount(project);

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
		||	[]
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
	for (const loader of FILE_TYPE_LOADERS) if (
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
		,	thumbnail: imgThumb
		,	foldersCount: 0
		,	layersCount: 0
		,	imagesCount: 0
		,	imagesLoadedCount: 0
		,	imagesLoaded: []
		,	loading: {
				startTime
			,	data: sourceFile
			,	images: []
			,	errorPossible: 'project_status_error_in_format'
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
		&&	(getTimeNow() - lastPauseTime) > PAUSE_WORK_INTERVAL
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

//* render default set when everything is ready:

			const	container = createProjectView(project);
				createOptionsMenu(project, getAllByClass('project-options', container)[0]);

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
				for (const switchName of SWITCH_NAMES_BY_TYPE[switchType]) if (params[switchName]) {
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
							min: paramMS.min
						,	max: paramMS.max
						};
					}
				}

			}

			function addOptionGroup(sectionName, listName) {
			const	optionGroup = getOptionGroup(sectionName, listName);
			const	optionParams = optionGroup.params;

				checkSwitchParams(optionParams);
				checkMinMaxParams(params, optionParams, 'multi_select');

				PARAM_KEYWORDS_SET_VALUE_TO_TRUE.forEach(
					(paramName) => {
						if (params[paramName]) {
							optionParams[paramName] = true;
						}
					}
				);

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
					PARAM_KEYWORDS_SET_VALUE_TO_NAME.forEach(
						(paramName) => {
							if (params[paramName]) {
								optionParams[paramName] = optionName;
							}
						}
					);

					optionItemLayers.push(layer);
				}
			}

			function addOptionsFromParam(sectionName, listName) {

				function addOptionsFromParamKeywords(keywordsList, paramList) {
					paramList.forEach(
						(optionValue) => {
						let	optionName = String(optionValue);

							if (isNaN(optionValue)) {
								optionName = optionName.replace(regNonAlphaNum, '').toLowerCase();

								if (PARAM_KEYWORDS_SHORTCUT_FOR_ALL.includes(optionName)) {
									keywordsList.forEach(
										(optionName) => {
											optionItems[optionName] = optionName;
										}
									);
								} else
								if (keywordsList.includes(optionName)) {
									optionItems[optionName] = optionName;
								} else
								if (getRGBAFromColorCodeOrName(optionValue)) {
									optionItems[optionValue] = optionValue;
								}
							} else {
								optionItems[optionName] = optionValue;
							}
						}
					);
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
					optionItems[sectionName] = sectionName;
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

					if (paddings) {
						paddings.forEach(
							(padding) => {
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
						);
					}

					layer.isMaskGenerated = true;
				} else
				if (sectionName === 'autocrop') {
					addOptionsFromParamKeywords(PARAM_KEYWORDS_AUTOCROP, param);
				} else
				if (sectionName === 'collage') {
					if (listName === 'align') {
						addOptionsFromParamKeywords(PARAM_KEYWORDS_COLLAGE_ALIGN, param[listName]);
					} else {
						param[listName].forEach(
							(optionValue) => {
							const	optionName = String(optionValue);
								optionItems[optionName] = optionValue;
							}
						);
					}
				} else
				if (sectionName === 'zoom' || sectionName === 'opacities') {
				const	format = param.format;

					if (format) {
						optionParams.format = format;
					}

				const	values = param.values;

					if (values) {
						values.forEach(
							(optionValue) => {

//* pad bare numbers to avoid numeric autosorting in <select>:

							const	optionName = optionValue + '%';

								if (sectionName === 'opacities') {
									optionValue = (orz(optionValue) / 100);
								}

								optionItems[optionName] = optionValue;
							}
						);
					}
				}
			}

		const	params = layer.params;
		const	name = layer.name;
		const	names = layer.names = (
				name
				.split(regSplitLayerNames)
				.map(trim)
				.filter(arrayFilterNonEmptyValues)
				.filter(arrayFilterUniqueValues)
			);

			if (isLayerSkipped(layer)) {
				return;
			}

			if (!names.length || params.none) {
				names.push('');
			}

		const	layersInside = layer.layers;
		const	layerCopyParams = params.copypaste;

			if (layerCopyParams) {
			const	aliasTypes = getOrInitChild(project, 'layersForCopyPaste');

				for (const paramType in layerCopyParams) {
				const	aliases = getOrInitChild(aliasTypes, paramType);

					layerCopyParams[paramType].forEach(
						(alias) => {
						const	layersByAlias = getOrInitChild(aliases, alias, Array);

							addToListIfNotYet(layersByAlias, layer);
						}
					);
				}
			}

			PARAM_OPTIONS_GLOBAL.forEach(
				(sectionName) => addOptionsFromParam(sectionName)
			);

			PARAM_OPTIONS_FOR_EACH_NAME.forEach(
				(sectionName) => names.forEach(
					(listName) => addOptionsFromParam(sectionName, listName)
				)
			);

			if (layer.isOptionList) {
				names.forEach(
					(listName) => addOptionGroup(layer.type, listName)
				);
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
					parent.names.forEach(
						(listName) => names.forEach(
							(optionName) => addOptionItem(layer, parent.type, listName, optionName)
						)
					);
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
		let	clippingLayer = null;

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

	let	options = null;

		project.layers = getUnskippedProcessedLayers(project.layers);

		if (options) {

//* Use dummy layers to process default parameters without adding them to the tree:

			for (const sectionName in PARAM_OPTIONS_ADD_BY_DEFAULT) if (!options[sectionName]) {
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

							layer.isUnalterable = !(
								isContentAlterable
							||	(
									layer.isPassThrough
								// &&	!layer.names.some((name) => colorListNames.includes(name))
								)
							||	(
									layer.params.side
									? VIEW_SIDES.includes(layer.params.side)
									: layer.isVisibilityOptional
								)
							);

							return (
								layer.isUnalterable
							&&	!layer.names.some((name) => alterableLayerNames.includes(name))
							&&	isResultUnalterable
							);
						}
					,	true
					);
				}

			let	section;
			let	alterableLayerNames = [];
			let	colorListNames = [];

				for (const sectionName of PARAM_OPTIONS_LOCAL) if (section = options[sectionName])
				for (const listName of Object.keys(options[sectionName])) {
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

		const	section = options[sectionName];
		const	isEntryList = (entry && !isString(entry));
		const	optionLists = (isEntryList ? entry : section);

		let	optionList = null;
		let	colorStyles = null;

//* list box = set of parts:

			for (const listName in optionLists) if (optionList = section[listName]) {
			const	listLabel = getLocalizedText((isEntryList ? optionLists[listName] : entry) || listName);
			const	items = optionList.items;
			const	params = optionList.params;

			const	isZeroSameAsEmpty = (
					ZERO_PERCENT_EQUALS_EMPTY
				&&	NAME_PARTS_PERCENTAGES.includes(sectionName)
				);

			let	addEmpty = !(
					sectionName === 'side'
				||	'' in items
				) && (
					params.multi_select
				&&	params.multi_select.min <= 0
				);

			const	tr = cre('tr', table);
				tr.className = 'project-option';

			const	td = cre('td', tr);
				td.title = listLabel;
				td.textContent = listLabel + ':';

			const	selectBox = cre('select', cre('td', tr));
				selectBox.name = listName;
				selectBox.setAttribute('data-section', sectionName);

				if (sectionName !== 'collage')
				for (const switchType in SWITCH_NAMES_BY_TYPE) {
				const	implicitName = getPropByNameChain(project, 'switchParamNames', switchType, 'implicit');
				const	explicitName = getPropByNameChain(project, 'switchParamNames', switchType, 'explicit');
				const	isImplied = (typeof params[explicitName] === 'undefined');

					params[implicitName] = isImplied;
					params[explicitName] = !isImplied;

				const	switchNames = SWITCH_CLASS_BY_TYPE[switchType];
				const	td = cre('td', tr);
				const	label = cre('label', td);
				const	checkBox = cre('input', label);

					checkBox.type = 'checkbox';
					checkBox.className = switchType + '-checkbox';
					checkBox.setAttribute('data-switch-type', switchType);
					checkBox.checked = checkBox.initialValue = !params[SWITCH_NAMES_BY_TYPE[switchType][0]];
					checkBox.params = params;

					for (const index in switchNames) {
					const	switchName = switchNames[index];
					const	button = cre('div', label);

						button.className = switchType + '-' + switchName + ' ' + SWITCH_CLASS_BY_INDEX[index];
						button.title = (
							getLocalizedText('switch_' + switchName)
						+	':'
						+	TITLE_LINE_BREAK
						+	getLocalizedText('hint_switch_' + switchName)
						);
					}
				}

//* list item = each part:

				for (const optionName in items) {
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

					if (sectionName === 'separate') {
						if (project.layersTopSeparated) {
							project.layersTopSeparated.forEach(
								(layer, index) => {
									addOption(selectBox, (index + 1) + ': ' + layer.name);
								}
							);
						}
					} else
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
						if (sectionName === 'side') {
							optionLabel = getLocalizedText(sectionName + '_' + optionName);
						} else
						if (sectionName === 'colors') {
							items[optionName].forEach(
								(layer) => addOptionColor(layer.img)
							);
						}

					const	optionItem = addOption(selectBox, optionLabel, optionValue);

						colorStyles.forEach(
							(colorStyle) => {

							//* standard only allows minimal styling of options, no nested color boxes:

								optionItem.style.backgroundColor = colorStyle;
								optionItem.style.color = (
									isColorDark(colorStyle)
									? 'white'
									: 'black'
								);
							}
						);
					}
				}

				if (addEmpty) {
					addOption(selectBox, '', isZeroSameAsEmpty ? '0%' : '');
				}

			const	preselectByValue = getPropByNameChain(project, 'options', sectionName, listName, 'params', 'preselect');

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

		getAllByTag('th', table).forEach(
			(th) => {
				th.colSpan = maxTabCount;
			}
		);
	}

	return await getProjectOptionsContainer(project);
}

function createProjectView(project) {
const	container = cre('div');

const	headerTitle = cre('header', container);
	headerTitle.className = 'project-header filename';
	headerTitle.textContent = project.fileName;

const	headerInfo = cre('header', container);
	headerInfo.className = 'project-header project-info';

//* show overall project info:

const	summary       = cre('section', headerInfo);
const	summaryBody   = cre('div',    summary);
const	summaryFooter = cre('footer', summary);

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
const	layersTextParts = [];

	if (layersCount)  layersTextParts.push(getLocalizedText('project_layers', layersCount));
	if (foldersCount) layersTextParts.push(getLocalizedText('project_folders', foldersCount));

const	layersText = getNestedFilteredArrayJoinedText(layersTextParts, ', ');
const	summaryTextParts = [resolutionText, layersText];

const	sourceFile = project.loading.data.file || {};
const	sourceFileTime = sourceFile.lastModified || sourceFile.lastModifiedDate;

	if (imagesCount)     summaryTextParts.push('<span class="project-images-loaded"></span>');
	if (sourceFile.size) summaryTextParts.push(getFormattedFileSize(sourceFile.size));
	if (sourceFileTime)  summaryTextParts.push(getLocalizedText('file_date', getFormattedTime(sourceFileTime)));

	summaryBody.innerHTML = getNestedFilteredArrayJoinedText(summaryTextParts, '<br>');
	project.imagesLoadedCountText = getAllByClass('project-images-loaded', summaryBody)[0];
	updateProjectLoadedImagesCount(project);

	for (const buttonName of PROJECT_FILE_CONTROLS) {
		addNamedButton(summaryFooter, buttonName);
	}

//* add batch controls:

	if (project.options) {
		for (const controlGroup of PROJECT_VIEW_CONTROLS) {
		const	buttons = controlGroup.buttons;
		const	buttonsGroup = cre('section', headerInfo);
		const	buttonsHeader = cre('header', buttonsGroup);
		const	buttonsFooter = cre('footer', buttonsGroup);

			buttonsHeader.textContent = getLocalizedText(controlGroup.header) + ':';

			addButtonGroup(buttonsFooter, buttons);
		}

		container.addEventListener('change', onProjectMenuUpdate, false);

//* place for results:

	const	tr = cre('tr', cre('table', container));
		cre('td', tr).className = 'project-options';
		cre('td', tr).className = 'project-render';
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
					project.mergedImage = img;

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
const	img = await getProjectMergedImagePromise(project, {
		alsoSetThumbnail: true,
	});

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

	const	preview = cre('div', container)
		preview.className = 'preview';
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

	function addUniqueParamValuesToList(paramType, values) {
	const	collection = getOrInitChild(params, paramType, Array);

		values.forEach(
			(value) => addToListIfNotYet(collection, value)
		);
	}

	function addUniqueParamPartsToList(sectionName, listName, value) {
	const	section = getOrInitChild(params, sectionName);
	const	collection = getOrInitChild(section, listName, Array);

		addToListIfNotYet(collection, value);
	}

	function getWIPLayerPathText() {
		return getLayerPathText(layer.parent) + '"' + (layer.nameOriginal || layer.name) + '"';
	}

	if (!layer) {
		layer = {name: 'dummy'};
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
		for (const paramType in regLayerNameParamType) if (match = param.match(regLayerNameParamType[paramType])) {

			if (NAME_PARTS_FOLDERS.includes(paramType)) {
				layer.type = paramType;
				layer.isVisibilityOptional = true;
			} else
			if (paramType === 'zoom' || paramType === 'opacities') {
			const	values = getUniqueNumbersArray(match[1]);
			const	format = orz(match[2]);
			const	collection = params[paramType];

				if (collection) {
					values.forEach(
						(value) => addToListIfNotYet(collection.values, value)
					);

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

			const	paramTextParts = (
					param
					.split('/')
					.filter(arrayFilterNonEmptyValues)
					.map((text) => text.toLowerCase())
				);

				paramTextParts.forEach(
					(paramTextPart) => {

				//* methods:

						if (PARAM_KEYWORDS_SHORTCUT_FOR_ALL.includes(paramTextPart)) {
							PARAM_KEYWORDS_PADDING_METHODS.forEach(
								(keyword) => addToListIfNotYet(methods, keyword)
							);
						} else
						if (PARAM_KEYWORDS_PADDING_METHODS.includes(paramTextPart)) {
							addToListIfNotYet(methods, paramTextPart);
						} else

				//* thresholds:

						if (
							hasPrefix(paramTextPart, 'at')
						||	(paramTextPart.replace(regNumDots, '') === 'a')
						) {
							getRangeValuesFromText(
								paramTextPart
								.replace(regTrimParamRadius, '')
							)
							.forEach(
								(value) => (
									addToListIfNotYet(thresholds, Math.abs(orz(value)))
								)
							);

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
												'radius': interval
											}
										);
									}
									: (interval) => {
										count += addToListIfNotYet(
											boundaries
										,	{
												'x': interval
											,	'y': interval
											}
										);
									}
								);

								if (directions.length > 1) {
									forEachSetInCrossProduct(
										directions
									,	() => {
										const	interval = {
												'in': Math.min(...arguments)
											,	'out': Math.max(...arguments)
											};

											addToBoundaryList(interval);
										}
									);
								} else {
									directions[0].forEach(
										(outerRadius) => {
										const	interval = (
												isHollow
												? {
													'in': outerRadius
												,	'out': outerRadius
												}
												: {'out': outerRadius}
											);

											addToBoundaryList(interval);
										}
									);
								}
							} else
							if (isBox) {
								if (isHollow) {
									forEachSetInCrossProduct(
										[
											dimensions[0][0] || DUMMY_ARRAY
										,	dimensions[0][1] || DUMMY_ARRAY
										,	dimensions[1][0] || DUMMY_ARRAY
										,	dimensions[1][1] || DUMMY_ARRAY
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
													'x': {
														'in': Math.min(x1, x2)
													,	'out': Math.max(x1, x2)
													}
												,	'y': {
														'in': Math.min(y1, y2)
													,	'out': Math.max(y1, y2)
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
													'x': {'out': outerX}
												,	'y': {'out': outerY}
												}
											);
										}
									);
								}
							}
						}
					}
				);

				if (
					boundaries.length > 0
				||	methods.length > 0
				||	thresholds.length > 0
				) {
				const	collection = getOrInitChild(params, paramType, Array);

					if (!boundaries.length) {
						boundaries = [{'radius': {'out': DEFAULT_ALPHA_MASK_PADDING}}];
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
			if (paramType === 'copypaste') {
				addUniqueParamPartsToList(paramType, match[1], match[2]);
			} else
			if (paramType === 'multi_select') {
			const	values = (
					match[1] === 'optional'
					? [0,1]
					: getNumbersArray(match[2], 2)
				);

				params[paramType] = {
					'min': Math.max(0, values[0])
				,	'max': Math.max(1, values[values.length > 1?1:0])
				};
			} else
			if (paramType === 'check_order') {
				params[paramType] = match[1];
			} else
			if (paramType === 'preselect') {
			const	key = 'last';
				params[param.includes(key) ? key : paramType] = true;
			} else
			if (paramType === 'batch') {
				params[param === paramType ? paramType : 'single'] = true;
			} else
			if (paramType === 'autocrop') {
			const	values = (
					(match[2] || DEFAULT_AUTOCROP)
					.split('/')
					.filter(arrayFilterNonEmptyValues)
				);

				addUniqueParamValuesToList(paramType, values);
			} else
			if (paramType === 'collage') {
			const	values = (
					(match[2] || DEFAULT_COLLAGE)
					.split('/')
					.filter(arrayFilterNonEmptyValues)
				);

				values.forEach(
					(value) => {
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
								value = match[2] + 'px';
							}
						}

						if (listName) {
							asArray(values || value).forEach(
								(value) => asArray(listName).forEach(
									(listName) => addUniqueParamPartsToList(paramType, listName, value)
								)
							);
						}
					}
				);
			} else
			if (paramType === 'layout') {
				params[param === 'rows' || param === 'newline' ? 'newline' : 'inline'] = true;
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

async function getNextParentAfterAddingLayerToTree(layer, sourceData, name, parentGroup, isLayerFolder, isInsideVirtualPath) {
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
	if (typeof layer.nameOriginal === 'undefined') layer.nameOriginal = name;

	name = name.replace(regTrimCommaSpace, '');

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

let	match = null;
let	separator = null;
let	subLayer = null;
let	isSubLayerFolder = false;

	while (match = name.match(regLayerNameParamOrComment)) if (
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
			nameOriginal: layer.nameOriginal
		,	isVirtualFolder: true
		,	isVisible: true
		,	opacity: 1
		};

		VIRTUAL_FOLDER_TAKEOVER_PROPERTIES.forEach(
			([ key, defaultValue ]) => {
				if (subLayer[key] !== defaultValue) {
					layer[key] = subLayer[key];
					subLayer[key] = defaultValue;
				} else {
					layer[key] = defaultValue;
				}
			}
		);

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

	if (project.imagesLoadedCount === loadedCount) {
		return;
	}

	project.imagesLoadedCount = loadedCount;

	if (!project.isLoaded) {
		updateProjectOperationProgress(
			project
		,	'project_status_reading_images'
		,	loadedCount
		,	imagesCount
		);
	}

	if (!element) {
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
}

function updateProjectOperationProgress(project, operation, ...args) {
	if (TESTING > 9) console.log(arguments);

	if (operation === 'project_status_ready_options') {
	const	counted = args[0];
	const	count = (
			(typeof counted === 'undefined')
			? (project.renderBatchCountSelected || '?')
			: (counted === '?')
			? (project.renderBatchCountSelected || counted)
			: (project.renderBatchCountSelected = counted)
		);

		if (count) {
			args[0] = count;

			updateMenuBatchCount(project, count);
		}
	}

let	element;

	if (TAB_STATUS_TEXT) {
		if (element = project.buttonStatus) {
			element.textContent = getLocalizedText(operation, ...args);
		}
	} else {
		if (element = project.buttonTab) {
			element.title = getLocalizedText(operation, ...args);
		}
	}

	if (TAB_WIDTH_ONLY_GROW) {
		if (element = project.buttonStatus || project.buttonText || project.buttonTab) {
		const	width = element.offsetWidth;

			if (width > orz(element.style.minWidth)) {
				element.style.minWidth = width + 'px';
			}
		}
	}
}

function setImageGeometryProperties(target, ...sources) {
	IMAGE_GEOMETRY_KEYS.forEach(
		(keys) => {
		const	targetKey = keys[0];

			if (targetKey in target) {
				return;
			}

			for (const source of sources) if (isNonNullObject(source))
			for (const key of keys) if (source[key]) {
				target[targetKey] = orz(source[key]);

				return;
			}

			// target[targetKey] = 0;
		}
	);
}

//* Page-specific functions: internal, loading from file *---------------------

async function loadCommonWrapper(project, libName, getFileParserPromise, treeConstructorFunc) {

	project.loading.errorPossible = 'project_status_error_loading_library';
	project.loading.errorParams = libName;

	if (! await loadLibOnDemandPromise(libName)) {
		return;
	}

let	sourceData = null;
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
		project.loading.errorPossible = 'project_status_error_in_layers';
		project.sourceData = sourceData;

		if (TAB_THUMBNAIL_PRELOAD) {
			getProjectMergedImagePromise(project, {
				alsoSetThumbnail: true,
			});
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
						,	(done, total) => updateProjectOperationProgress(
								project
							,	'project_status_reading_file'
							,	done
							,	total
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

			const	name	= layer.name || '';
			const	mode	= layer.composite || '';
			const	mask	= layer.mask || null;
			const	layers	= layer.layers || null;
			const	blendMode = getNormalizedBlendMode(mode);
			const	isLayerFolder = (layers && layers.length > 0);

			const	isPassThrough = (
					blendMode === BLEND_MODE_PASS
				||	layer.isolation === 'auto'
				);

			const	isClipped = (
					blendMode === BLEND_MODE_CLIP
				||	getTruthyValue(layer.clipping)		//* <- non-standard, for testing
				);

			const	isVisible = (
					typeof layer.visibility === 'undefined'
				||	layer.visibility === 'visible'
				||	layer.visibility !== 'hidden'
				||	getTruthyValue(layer.visibility)	//* <- non-standard, for testing
				);

			const	layerWIP = {
					blendMode
				,	blendModeOriginal: mode
				,	isClipped
				,	isPassThrough
				,	isVisible
				,	opacity: orzFloat(layer.opacity)
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
				&&	(getTimeNow() - lastPauseTime) > PAUSE_WORK_INTERVAL
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

async function loadPSD       (project) {return await loadPSDCommonWrapper(project, 'psd.js', 'PSD_JS');}
async function loadPSDBrowser(project) {return await loadPSDCommonWrapper(project, 'psd.browser.js', 'PSD');}

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
				isNaN(projectMode)
				? projectMode
				: PSD_COLOR_MODES[projectMode]
			);

//* gather layers into a tree object:

			async function addLayerToTree(layer, parentGroup) {
			const	node = layer;
				layer = node.layer || node;

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
				||	isNaN(fillOpacity)
				);

			const	layers = (
					node.hasChildren()
					? node.children()
					: null
				);

			const	isLayerFolder = (layers && typeof layers.length !== 'undefined');

			const	layerWIP = {
					blendMode
				,	blendModeOriginal: blending
				,	isPassThrough
				,	isClipped: getTruthyValue(clipping)
				,	isVisible: getTruthyValue(layer.visible)

//* Note:
//*	"Fill" opacity is used in PSD from SAI2
//*	to store opacity value instead of standard opacity
//*	for layers with certain blending modes (non-TS versions).
//* source: https://github.com/meltingice/psd.js/issues/153#issuecomment-436456896

				,	isBlendModeTS: (
						hasNoFillOpacityValue
					&&	BLEND_MODES_WITH_TS_VERSION.includes(blendMode)
					)
				,	opacity: (
						getNormalizedOpacity(layer.opacity)
					*	(hasNoFillOpacityValue ? 1 : getNormalizedOpacity(fillOpacity))
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
							defaultColor: orz(mask.defaultColor)
						,	imgData: img.maskData		//* <- RGBA byte array
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
				&&	(getTimeNow() - lastPauseTime) > PAUSE_WORK_INTERVAL
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

function isOptionRelevant(project, values, sectionName, listName, optionName) {

const	relevantLayers = getProjectOptionValue(project, sectionName, listName, optionName);

	if (
		isArray(relevantLayers)
	&&	relevantLayers.length > 0
	) {
	const	section = values[sectionName];
	const	oldOptionName = section[listName];
	const	isOptionNameChanged = (oldOptionName !== optionName);

	let	result = false;

		if (isOptionNameChanged) {
			section[listName] = optionName;
		}

		for (const layer of relevantLayers) {
			if (getLayerPathVisibilityByValues(project, layer, values, listName)) {
				result = true;

				break;
			}
		}

		if (isOptionNameChanged) {
			section[listName] = oldOptionName;
		}

		return result;
	}

	return true;
}

function isSetOfValuesOK(project, values) {
	for (const sectionName in values) {
	const	section = values[sectionName];

		if (section) {
			for (const listName in section) {
			const	optionName = section[listName];

				if (!isOptionRelevant(project, values, sectionName, listName, optionName)) {
					return false;
				}
			}
		}
	}

	return true;
}

function getSetOfRelevantValues(project, values) {
const	resultSet = {};

	for (const sectionName in values) {
	const	section = values[sectionName];

		if (section) {
			for (const listName in section) {
			const	optionName = section[listName];
			const	resultSection = getOrInitChild(resultSet, sectionName);

				resultSection[listName] = (
					isOptionRelevant(project, values, sectionName, listName, optionName)
					? optionName
					: ''
				);
			}
		}
	}

	return resultSet;
}

function selectValueByPos(selectBox, targetPosition) {
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
		for (const option of selectBox.options) if (
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

async function setAllValues(project, targetPosition) {
	getAllByTag('select', project.container).forEach(
		(selectBox) => selectValueByPos(selectBox, targetPosition)
	);

	if (
		targetPosition === 'init'
	||	targetPosition === 'empty'
	) {
		getAllByType('checkbox', project.container).forEach(
			(checkBox) => {
				checkBox.checked = (
					targetPosition === 'init'
					? checkBox.initialValue
					: false
				);

				updateCheckBox(checkBox);
			}
		);
	}

	await updateBatchCount(project);
	await showImg(project);
}

function getAllMenuValues(project, checkSelectedValue) {
const	values = {};

	getAllByTag('select', project.container).forEach(
		(selectBox) => {
		const	sectionName = selectBox.getAttribute('data-section');
		const	listName    = selectBox.name;
		const	optionLists = getOrInitChild(values, sectionName);

			optionLists[listName] = (
				sectionName === 'collage'
			||	(
					checkSelectedValue
				&&	getPropByNameChain(project, 'options', sectionName, listName, 'params', 'single')
				)
				? [selectBox.value]
				: getAllByTag('option', selectBox).map((option) => option.value)
			);
		}
	);

	return values;
}

async function getAllValueSets(project, values, startTime, flags) {

	async function goDeeper(optionLists, partialValueSet) {

	const	[ sectionName, listName, optionNames ] = optionLists[0];
	const	partialValueSetText = JSON.stringify(partialValueSet || {});
	const	optionsLeft = (
			optionLists.length > 1
			? optionLists.slice(1)
			: null
		);

	let	isGoingDeeper = true;

		for (const optionName of optionNames) {
			aborted = (
				isStopRequestedAnywhere(project)
				|| (
					startTime
				&&	startTime !== project.renderBatchCounterStartTime
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

		let	values = JSON.parse(partialValueSetText);
			getOrInitChild(values, sectionName)[listName] = optionName;

			if (optionsLeft) {
				isGoingDeeper = await goDeeper(optionsLeft, values);
			} else
			if (isSetOfValuesOK(project, values = getSetOfRelevantValues(project, values))) {
			const	fileName = getKeyForValueSet(project, values);

				if (getOnlyNames) {
					if (addToListIfNotYet(valueSets, fileName)) {
						++addedCount;
					}
				} else
				if (!(fileName in valueSets)) {
					valueSets[fileName] = values;

					++addedCount;
				}

				if (
					ADD_PAUSE_AT_INTERVALS
				&&	(getTimeNow() - lastPauseTime) > PAUSE_WORK_INTERVAL
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

let	valueSets = getOnlyNames ? [] : {};
let	aborted = false;
let	addedCount = 0;
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

	if (optionLists.length > 0) {
		if (ADD_PAUSE_AT_INTERVALS) {
			lastPauseTime = startTime || getTimeNow();
		}

		if (! await goDeeper(optionLists)) {
			valueSets = getOnlyNames ? null : {};
		}
	}

	if (aborted) {
		return;
	}

	return valueSets;
}

async function getAllValueSetsCount(project, values, startTime) {
const	valueSets = await getAllValueSets(
		project
	,	values
	,	startTime
	,	{
			getOnlyNames: true,
			checkSelectedValue: true,
			stopAtMaxCount: MAX_BATCH_PRECOUNT && MAX_BATCH_PRECOUNT > 0,
		}
	);

	if (typeof valueSets === 'undefined') {
		return;
	}

	return (
		valueSets === null
		? getLocalizedText('too_many')
		: valueSets.length
	);
}

function getUpdatedMenuValues(project, updatedValues) {
const	values = {};

	getAllByTag('select', project.container).forEach(
		(selectBox) => {

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

				getAllByTag('option', selectBox).forEach(
					(option) => {
					const	optionName = option.value || '';
					const	hide = !isOptionRelevant(project, updatedValues, sectionName, listName, optionName);

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
				);

				hide = (allHidden ? 'none' : '');

				selectValue(selectBox, (
					!hide && selectedValueHidden
					? fallbackValue
					: selectedValue
				));

			const	container = getThisOrParentByClass(selectBox, 'project-option') || selectBox.parentNode;
			const	style = container.style;

				if (style.display != hide) {
					style.display = hide;
				}
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
	);

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

			let	rgbaMask = null;

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
				for (let referenceY, dy = -pixelsAround; dy <= pixelsAround; dy++) if ((referenceY = resultY + dy) >= 0 && referenceY < h) next_pixel_around:
				for (let referenceX, dx = -pixelsAround; dx <= pixelsAround; dx++) if ((referenceX = resultX + dx) >= 0 && referenceX < w) {

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
				for (let referenceY, dy = -pixelsAroundY; dy <= pixelsAroundY; dy++) if ((referenceY = resultY + dy) >= 0 && referenceY < h) next_pixel_around:
				for (let referenceX, dx = -pixelsAroundX; dx <= pixelsAroundX; dx++) if ((referenceX = resultX + dx) >= 0 && referenceX < w) {

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

	canvas.top    = orz(img.top);
	canvas.left   = orz(img.left);
	canvas.width  = orz(img.width)  || project.width;
	canvas.height = orz(img.height) || project.height;

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

	if (
		!fillColor
	||	(
			!imgOrLayer.left
		&&	!imgOrLayer.top
		&&	(!imgOrLayer.width  || imgOrLayer.width  === project.width)
		&&	(!imgOrLayer.height || imgOrLayer.height === project.height)
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

const	w = orz(getPropFromAnySource('width',  imgOrLayer, imgElement, project));
const	h = orz(getPropFromAnySource('height', imgOrLayer, imgElement, project));
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
let	canvas = null;
let	color = null;
const	selectedColors = project.rendering.colors;

	if (selectedColors) {
		if (listName in selectedColors) {
			color = selectedColors[listName];
		} else {
		const	optionalColors = getSelectedOptionValue(project, values, 'colors', listName);

			if (optionalColors) {
				for (const layer of optionalColors) if (
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

function getProjectOptionValue(project, sectionName, listName, optionName) {
	return getPropByNameChain(project, 'options', sectionName, listName, 'items', optionName);
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

function getLayerPathVisibilityByValues(project, layer, values, listName) {
	if (TESTING && !layer.params) {
		console.error('No params:', [project, layer, values, listName]);
	}

	if (layer.params.check_order === 'up') {
		if (getLayerVisibilityChain(layer).some(
			(layer) => !getLayerVisibilityByValues(project, layer, values, listName)
		)) {
			return false;
		}
	} else {
		do {
			if (!getLayerVisibilityByValues(project, layer, values, listName)) {
				return false;
			}
		} while (layer = layer.clippingLayer || getParentLayer(layer));
	}

	return true;
}

function getLayerVisibilityByValues(project, layer, values, listName) {

	function skipByFunc(layer, callback, isNot) {
		return (
			layer.names
			? (
				isNot
				? layer.names.some((name) => callback(name, isNot))
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

	function getOpacityByAnyName(listNames) {
	let	maxOpacity = -1;
	let	unselectable = false;

		for (const listName of listNames) {
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

let	isVisible = !!(
		layer.isVisible
	||	layer.isVisibilityOptional
	||	layer.params.skip_render
	);

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

	return getOpacityByAnyName(listName ? [listName] : layer.names);
}

async function getRenderByValues(project, values, nestedLayersBatch, renderParams) {

	async function renderOneLayer(layer) {

		async function onOneLayerDone() {
			PR.nestedLayers.pop();

			if (
				ADD_PAUSE_AT_INTERVALS
			&&	(getTimeNow() - PR.lastPauseTime) > PAUSE_WORK_INTERVAL
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

	const	backward = (
			layer.isOrderedBySide
		&&	isBackSide
		);

	const	flipSide = orz(backward ? layer.flipSide : 0);

	const	names = layer.names;
	const	params = layer.params;
	const	skipColoring = !!params.if_only;		//* <- check logical visibility, but skip recolor
	const	ignoreColors = !!renderParams.ignoreColors;	//* <- only care about alpha channel, for mask generation
	const	skipCopyPaste = !!renderParams.skipCopyPaste;
	const	clippingGroupWIP = !!renderParams.clippingGroupWIP;

	const	canSaveMergedImage = (
			!!renderParams.canSaveMergedImage
		&&	!skipCopyPaste
		&&	layer.isUnalterable
		);

	let	clippingGroupLayers = null;
	let	clippingGroupResult = false;

//* step over clipping group to render or skip at once:

		if (
			!clippingGroupWIP
		&&	!ignoreColors
		) {
			clippingGroupLayers = [];

		let	siblingIndex = indexToRender;
		let	siblingLayer = null;

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

	let	img = null;
	let	canvasCopy = null;

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
				,	clippingGroupWIP: true
				}
			);

			if (TESTING_RENDER) addDebugImage(project, img, 'clippingGroupResult: img = getRenderByValues', 'cyan');
		} else {

		const	addCopyPaste = (
				skipCopyPaste
				? null
				: getPropByNameChain(params, 'copypaste', 'paste')
			);

		let	layers = layer.layers || null;

//* append copypasted layers to subqueue:

			if (isArray(addCopyPaste)) {
				if (!isArray(layers)) {
					layers = (layer.img ? [layer] : []);
				}

				addCopyPaste.forEach(
					(alias) => (
						getPropByNameChain(project, 'layersForCopyPaste', 'copy', alias) || []
					).forEach(
						(layer) => addToListIfNotYet(layers, layer)
					)
				);
			}

			if (isArray(layers)) {

//* get a flat color fill, using the first non-empty value found in associated lists:

				if (
					!skipColoring
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
							canvasCopy = getCanvasFlipped(project, canvas, flipSide, {isCopyNeeded: true});
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
								ignoreColors: (ignoreColors || isToRecolor)
							,	baseCanvas: canvasCopy
							,	opacity: (addCopyPaste ? opacity : 0)	//* <- TODO: properly check copypaste visibility
							,	skipCopyPaste: !!addCopyPaste
							,	canSaveMergedImage: !layer.isUnalterable
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
			} else {

//* not a folder, not a stack of copypaste:

				img = layer.img || await getOrLoadImage(project, layer);
			}
		}

		if (img) {
		let	mask = null;

			if (clippingGroupResult) {
				opacity = 1;
			} else {

//* get mask of neighbour content, rendered before or after this layer:

				if (layer.isMaskGenerated) {
				const	paddings = names.map(
						(listName) => getSelectedOptionValue(project, values, 'paddings', listName)
					)
					.filter(arrayFilterNonEmptyValues);

					if (paddings.length > 0) {
						mask = await getRenderByValues(
							project
						,	values
						,	layersToRender.slice(0, indexToRender)	//* <- content after this layer
						,	{
								ignoreColors: true
							}
						);

						if (TESTING_RENDER) addDebugImage(project, mask, 'mask = getRenderByValues');

//* apply padding to generated mask:

						if (mask) {
							paddings.forEach(
								(padding) => padCanvas(mask, padding)
							);

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
					!skipColoring
				&&	!ignoreColors
				&&	!layer.isColorList	//* <- already got selected color fill
				) {
					names.forEach(
						(listName) => {
							img = getCanvasColored(project, values, listName, img);
						}
					);
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

let	layer, layersToRenderOne;

	if (project.rendering) {
		if (nestedLayersBatch) {
			++project.rendering.layersBatchCount;
		} else {
			logTime('getRenderByValues - skipped call without layers while rendering.');

			return;
		}
	} else {
	const	indexToRender = orz(getPropBySameNameChain(values, 'separate'));

		if (indexToRender > 0) {
		const	layers = project.layersTopSeparated;

			if (
				layers
			&&	(layer = layers[indexToRender - 1])
			) {
				layersToRenderOne = (getParentLayer(layer) || project).layers;
			} else {
				logTime('getRenderByValues - skipped call, separate layer not found.');

				return;
			}
		}

	const	startTime = getTimeNow();

		project.rendering = {
			startTime
		,	lastPauseTime: startTime
		,	fileName: getFileNameByValues(project, values)
		,	layersApplyCount: 0
		,	layersBatchCount: 1
		,	nestedLevelMax: 0
		,	nestedLayers: []
		,	colors: {}
		};
	}

	if (!isNonNullObject(renderParams)) {
		renderParams = {};
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
		project.rendering = null;
	}

	return canvas;
}

function getFileNameByValues(project, values, flags) {

	function getProcessedSectionName(sectionName) {

		function getProcessedListName(listName) {
		let	optionName = section[listName];

			if (!optionName.length) {
				return;
			}

		const	params = getPropByNameChain(project, 'options', sectionName, listName, 'params');

			if (params) {
				if (flags.checkSelectedValue) {
					if (
						params.single
					||	!params.batch
					) {
						return;
					}
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
					flags.addAllListNames
				||	(
						FILE_NAME_ADD_PARAM_KEY
					&&	!params.no_prefix
					)
				) {
					optionName = listName + '=' + optionName;
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
		,	getFileNameByValues(project, values, flags)
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
	,	{ addAllListNames: true }
	);
}

async function getOrCreateRender(project, render) {
	if (!isNonNullObject(render)) {
		render = {};
	}

const	values    = render.values    || (render.values    = getUpdatedMenuValues(project));
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
const	refName   = render.refName   || (render.refName   = getFileNameByValuesToSave(project, refValues));
const	fileName  = render.fileName  || (render.fileName  = getFileNameByValuesToSave(project, values));
const	img       = render.img       || (render.img       = await getOrCreateRenderedImg(project, render));

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

				img.title = img.alt = (
					fileName + '.png'
				+	TITLE_LINE_BREAK
				+	'('
				+		img.width + 'x' + img.height
				+		(
							typeof msec === 'undefined'
							? '' :
							', ' + getLocalizedText('render_took_time', msec / 1000)
						)
				+	')'
				);

				prerenders[fileName] = img;

				return img;
			}
		).catch(catchPromiseError);
	}

	if (!render) {
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
			render = {values: render.refValues};
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
		const	cropRefName = getFileNameByValuesToSave(project, cropValues);

		const	cropId = [
				'x=' + crop.left
			,	'y=' + crop.top
			,	'w=' + crop.width
			,	'h=' + crop.height
			].join(',');

			cropValues.autocrop = {'autocrop': cropId};

		const	cropName = getFileNameByValuesToSave(project, cropValues);

			if (cropName in prerenders) {
				img = prerenders[fileName] = prerenders[cropName];
			} else
			if (
				crop.width < img.width
			||	crop.height < img.height
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
	setProjectWIPstate(project, true);

	if (!isNonNullObject(flags)) {
		flags = {};
	}

	if (!flags.saveToFile) {
		flags.showOnPage = true;
	}

	project.renderBatchCounterStartTime = null;

const	logLabel = 'Render all: ' + project.fileName;
	console.time(logLabel);
	if (USE_CONSOLE_LOG_GROUPING) console.group(logLabel);

const	startTime = getTimeNow();
const	values = getAllMenuValues(project, true);
const	valueSets = await getAllValueSets(project, values);

	if (
		isNonNullObject(valueSets)
	&&	!isStopRequestedAnywhere(project)
	) {
		await renderBatch(project, flags, startTime, values, valueSets);
	}

	if (USE_CONSOLE_LOG_GROUPING) console.groupEnd(logLabel);
	console.timeEnd(logLabel);

	setProjectWIPstate(project, false);
}

async function renderBatch(project, flags, startTime, values, valueSets) {
let	lastPauseTime = getTimeNow();

const	renderedImages = [];
const	needWaitBetweenDL = (flags.saveToFile && !flags.asOneJoinedImage);
const	optionsForNewLines = getNewLineOptionLists(project.options);
const	setsCountTotal = Object.keys(valueSets).length;

	await updateBatchCount(project, values, setsCountTotal);

let	setsCountWithoutPause = 0;
let	setsCount = 0;
let	totalTime = 0;
let	pauseAtIntervals = (ADD_PAUSE_AT_INTERVALS ? PAUSE_WORK_DURATION : 0);
let	batchContainer, subContainer;

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

	let	img = null;

		if (batchContainer) {
			subContainer = getNewLineSubcontainer(batchContainer, values, optionsForNewLines);
		}

		if (flags.showOnPage) {
			img = await showImg(
				project,
				render,
				subContainer
			);
		}

		if (flags.asOneJoinedImage) {
			if (!img) {
				img = await getRenderedImg(project, render);
			}

			if (
				img
			&&	addToListIfNotYet(renderedImages, img)
			&&	!flags.showOnPage
			) {
				subContainer.appendChild(img);
			}
		} else
		if (flags.saveToFile) {
			img = await saveImg(
				project,
				render,
				getFileNameByValuesToSave(
					project,
					values,
					{
						checkSelectedValue: true,
						skipDefaultPercent: true,
					}
				)
			);
		}

	const	endTime = getTimeNow();
		totalTime += (endTime - startTime);

		++setsCount;
		++setsCountWithoutPause;

//* Note: Chrome skips downloads if more than 10 in 1 second.
//* source: https://stackoverflow.com/a/53841885

		if (
			(needWaitBetweenDL && setsCountWithoutPause > 9)
		||	(ADD_PAUSE_AT_INTERVALS && (endTime - lastPauseTime > PAUSE_WORK_INTERVAL))
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

	if (
		flags.asOneJoinedImage
	&&	!isStopRequestedAnywhere(project)
	) {

		function getBatchCanvasSize(rootContainer) {
		let	x = 0;
		let	y = 0;
		let	w = 0;
		let	h = 0;
		let	element = rootContainer.firstElementChild;

			while (element) {
				if (isImageElement(element)) {
					element.batchOffsetX = x;
					element.batchOffsetY = y;

					w = Math.max(w, x + element.width);
					h = Math.max(h, y + element.height);

					x += element.width + joinedPadding;
				} else {
				const	size = getBatchCanvasSize(element);

					element.batchOffsetX = x = 0;
					element.batchOffsetY = y = (h > 0 ? h + joinedPadding : 0);

					w = Math.max(w, x + size.width);
					h = Math.max(h, y + size.height);

					y = h + joinedPadding;
				}

				element = element.nextElementSibling;
			}

			return {
				width: w
			,	height: h
			};
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

						img.title = img.alt = (
							project.fileName + '.png'
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
						saveDL(img.src, project.fileName + '_' + renderedImages.length, 'png', 1);
					}
				}
			}
		}
	}
}

function showAll(project) {renderAll(project);}
function saveAll(project) {renderAll(project, {saveToFile: true});}
function showJoin(project) {renderAll(project, {asOneJoinedImage: true});}
function saveJoin(project) {renderAll(project, {saveToFile: true, asOneJoinedImage: true});}

async function showImg(project, render, container) {
const	isSingleWIP = (render ? false : setProjectWIPstate(project, true));

let	img = null;

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

	if (isSingleWIP) setProjectWIPstate(project, false);

	return img;
}

async function saveImg(project, render, fileName) {
const	isSingleWIP = (render ? false : setProjectWIPstate(project, true));

let	img = null;

	try {
		render = await getOrCreateRender(project, render);
		img = render.img;

		if (img) {
			saveDL(img.src, fileName || render.fileName, 'png');
		}
	} catch (error) {
		logError(error, arguments);

		project.rendering = null;
	}

	if (isSingleWIP) setProjectWIPstate(project, false);

	return img;
}

async function getRenderedImg(project, render) {
const	isSingleWIP = (render ? false : setProjectWIPstate(project, true));

let	img = null;

	try {
		img = await getOrCreateRenderedImg(project, render);
	} catch (error) {
		logError(error, arguments);

		project.rendering = null;
	}

	if (isSingleWIP) setProjectWIPstate(project, false);

	return img;
}

function getEmptyRenderContainer(project) {
	return delAllChildNodes(
		project.renderContainer
	||	(project.renderContainer = getAllByClass('project-render', project.container)[0])
	);
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

	return await showImg(project);
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
	if (ADD_COUNT_ON_BUTTON_LABEL) {
		['show_all', 'save_all'].forEach(
			(name) => getAllByName(name, project.container).forEach(
				(button) => {
				const	label = button.lastElementChild || cre('span', button);
					label.className = 'count-label';
					label.textContent = args.join(' / ');
				}
			)
		);
	} else {
	let	label = project.renderBatchCountMenuLabel;

		if (!label) {
		const	labelClass = 'count-line';
			label = getAllByClass(labelClass, project.container)[0];

			if (!label) {
			let	container = getAllByName('show_all', project.container)[0] || project.container;
				container = getThisOrParentByTagName(container, 'section');

				label = project.renderBatchCountMenuLabel = cre('div', container, container.lastElementChild);
				label.className = labelClass;
			}
		}

		label.textContent = (
			getLocalizedOrEmptyText(
				args.length > 1
				? 'batch_counting'
				: 'batch_count'
			,	...args
			)
		||	args.join(' / ')
		);
	}
}

async function updateBatchCount(project, values, precounted) {
const	startTime = project.renderBatchCounterStartTime = getTimeNow();
const	precounts = getOrInitChild(project, 'renderBatchCounts');
const	key = (
		(
			getAllByClass('batch-checkbox', project.container)
			.map((checkBox) => (checkBox.checked ? 1 : 0))
			.join('')
		)
	+	'_'
	+	getFileNameByValues(project, values)
	);

let	count = (
		precounted
		? (precounts[key] = precounted)
		: precounts[key]
	);

	if (!count) {
		count = await getAllValueSetsCount(project, values, startTime);

		if (typeof count === 'undefined') {

//* stop if another count was started, skip updating:

			if (startTime !== project.renderBatchCounterStartTime) {
				return;
			} else {

//* stop if requested by user, but update text:

				count = '?';
			}
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

	updateProjectOperationProgress(project, 'project_status_ready_options', count);
}

function setProjectWIPstate(project, isWIP) {
const	state = !!isWIP;

	project.isStopRequested = false;
	project.isBatchWIP = state;

	['button', 'select', 'input'].forEach(
		(tagName) => getAllByTag(tagName, project.container).forEach(
			(element) => (
				element.disabled = (
					tagName === 'button'
				&&	element.name === 'stop'
					? !state
					: state
				)
			)
		)
	);

	updateProjectOperationProgress(
		project
	,	(
			state
			? 'project_status_rendering'
			: 'project_status_ready_options'
		)
	);

	return state;
}

function setGlobalWIPstate(isWIP) {
const	state = !!isWIP;

	isStopRequested = false;
	isBatchWIP = state;

	getAllByTag('button', getAllByClass('menu-bar')[0]).forEach(
		(element) => {
			if (element.name !== 'download_all') {
				element.disabled = (
					element.name === 'stop'
					? !state
					: state
				)
			}
		}
	);

	return state;
}

//* Page-specific functions: UI-side *-----------------------------------------

function onBeforeUnload(evt) {
	evt = eventStop(evt, FLAG_EVENT_STOP_IMMEDIATE);

	if (
		ASK_BEFORE_EXIT_IF_OPENED_FILES
	&&	getOneById('loaded-files-view').firstElementChild
	) {

//* Note: given message text won't be used in modern browsers.
//* source: https://habr.com/ru/post/141793/

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

	getAllByClass('menu-hid').forEach(
		(menuPanel) => putInView(menuPanel, 0,0, true)
	);
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
		pendingJobs.forEach(
			(job) => {
				job.isStopRequested = true;
			}
		);

		getAllByName('stop').forEach(
			(button) => button.click()
		);

		getAllByClass('loading', getOneById('loaded-files-selection')).forEach(
			(button) => {
				button.isStopRequested = true;

				if (button.project) {
					button.project.isStopRequested = true;
				}
			}
		);
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

const	container = getProjectContainer(button);
const	project = container.project;
const	action = button.name;
const	resetPrefix = 'reset_to_';

	if (action === 'stop') {
		project.isStopRequested = true;
	} else
	if (action === 'show') showImg(project); else
	if (action === 'save') saveImg(project); else
	if (action === 'show_all') showAll(project); else
	if (action === 'save_all') saveAll(project); else
	if (action === 'show_join') showJoin(project); else
	if (action === 'save_join') saveJoin(project); else
	if (hasPrefix(action, resetPrefix)) {
		setAllValues(project, action.substr(resetPrefix.length));
	} else
	if (action === 'show_project_details') {
		console.log(project);

		alert(getLocalizedText('see_console'));
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

	if (element.type === 'checkbox') {
		updateCheckBox(element);

		if (element.getAttribute('data-switch-type') !== 'batch') {
			return;
		}
	}

const	isSelect = isSelectElement(element);

	if (isSelect) {
		updateSelectStyle(element);

		if (element.getAttribute('data-section') === 'collage') {
			return;
		}
	}

const	container = getProjectContainer(element);
const	project = container.project;

	await updateBatchCount(project);

	if (isSelect) {
		await updateMenuAndShowImg(project);
	}
}

function onPageDragOver(evt) {
	evt = eventStop(evt, FLAG_EVENT_NO_DEFAULT);

const	batch = evt.dataTransfer;
const	files = batch.files;
const	items = batch.items;

	batch.dropEffect = (
		(files && files.length)
	||	(items && items.length && Array.from(items).some((item) => (item.kind === 'file')))
		? 'copy'
		: 'none'
	);
}

function onPageDrop(evt) {
	evt = eventStop(evt, FLAG_EVENT_NO_DEFAULT) || evt;

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

		for (const file of files) if (
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
const	thisJob = {startTime, files, evt};

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
				files.map((file) => file.name)
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

	if (TESTING > 9) console.log(thisJob, pendingJobs);

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
		&&	(container = getThisOrParentByClass(button, 'example-file'))
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
//* source: https://stackoverflow.com/a/53841885

					if (++countWithoutPause >= 10) {
						countWithoutPause = 0;

						await pause(1000);
					}
				}
			}
		} else
		if (action === 'load_all') {
			setGlobalWIPstate(true);

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

			setGlobalWIPstate(false);
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

			getAllById(otherButtonTab.id).forEach(
				(element) => toggleClass(element, 'show', selectedState)
			);

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
		'PAUSE_WORK_DURATION',
		'PAUSE_WORK_INTERVAL',
		'PREVIEW_SIZE',
		'TAB_PREVIEW_SIZE',
		'TAB_THUMBNAIL_SIZE',
		'TAB_ZOOM_STEP_MAX_FACTOR',
		'THUMBNAIL_SIZE',
		'ZOOM_STEP_MAX_FACTOR',
	];

	configVarNames.forEach(
		(varName) => {
			configVarDefaults[varName] = window[varName];
		}
	);

//* load redefined config:

	logLabel = 'Init external config';
	console.time(logLabel);

	await loadLibPromise(CONFIG_FILE_PATH);

	console.timeEnd(logLabel);

//* restore invalid config values to default:

	configVarNames.forEach(
		(varName) => {
		const	configuredValue = orz(window[varName]);
		const	invalidBottom = (varName.includes('FACTOR') ? 1 : 0);

			window[varName] = (
				configuredValue > invalidBottom
				? configuredValue
				: configVarDefaults[varName]
			);
		}
	);

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

	FILE_TYPE_LOADERS.forEach(
		(loader) => {
		const	exts = loader.dropFileExts || [];
		const	mimeTypes = loader.inputFileAcceptMimeTypes || [];
		const	lowerCaseExts = exts.map((ext) => ext.toLowerCase());
		const	upperCaseExts = exts.map((ext) => ext.toUpperCase());
		const	key = upperCaseExts.shift();
		const	otherTypesByKey = getOrInitChild(fileTypesByKeys, key, Array);

			upperCaseExts.forEach(
				(ext) => addToListIfNotYet(otherTypesByKey, ext)
			);

			lowerCaseExts.forEach(
				(ext) => addToListIfNotYet(inputFileAcceptTypes, '.' + ext)
			);

			mimeTypes.forEach(
				(mimeType) => addToListIfNotYet(inputFileAcceptTypes, mimeType.toLowerCase())
			);
		}
	);

const	supportedFileTypesText = (
		Object.keys(fileTypesByKeys)
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
			(value) => wrap.code.param(
				isFunction(value.split)
				? value.split('/').join('\n')
				: value
			)
		);
	}

const	wrap = {
		'code': {},
		'span': {},
	};

const	wrapperClassNames = [
		'comment',
		'folder ignore',
		'ignore',
		'name',
		'nested-layer ignore',
		'param',
		'path',
	];

	wrapperClassNames.forEach(
		(className) => {
		const	key = className.split(regNonAlphaNum)[0];

			for (const tagName in wrap) {
				wrap[tagName][key] = (...values) => (
					'<' + tagName + ' class="' + className + '">'
				+		values.join('')
				+	'</' + tagName + '>'
				);
			}
		}
	);

const	helpSections = {
		'autocrop': [
			{
				'text_key': 'notes',
			}, {
				'code_sample': '[autocrop={help_code_color_value}/{help_code_color_value}2/({help_code_more_values})]',
				'text_key': 'color',
				'text_replace_values': [getHelpSectionLinkHTML('help_color_value')],
			}, {
				'code_sample': '[autocrop=top-left/top-right/bottom-left/bottom-right]',
				'text_key': 'corner',
			}, {
				'code_sample': '[autocrop=all/etc]',
				'text_key': 'all',
			}, {
				'code_sample': '[autocrop]',
				'text_key': 'default',
				'text_replace_values': getArrayCodeReplaceSlashToNewLine(DEFAULT_AUTOCROP),
			},
		],
		'batch': [
			{
				'text_key': 'notes',
				'text_replace_values': [
					getTableHTML(
						[
							'1.',
							[
								'<code>',
									wrap.span.name('{help_code_list_name_parts}'),
									wrap.span.param('[parts batch]'),
								'</code>',
							],
						], [
							'2.',
							[
								'<code>',
									wrap.span.name('{help_code_list_name_colors}'),
									wrap.span.param('[colors rows]'),
								'</code>',
							],
						], [
							'3.',
							[
								wrap.code.param('[zoom=50/100% no-batch]'),
							],
						],
					),
				],
			}, {
				'code_sample': [
					wrap.span.name('{help_code_list_name}') + '[batch]',
				],
				'text_key': 'all',
			}, {
				'code_sample': [
					wrap.span.name('{help_code_list_name}') + '[no-batch]',
					wrap.span.name('{help_code_list_name}') + '[single]',
				],
				'text_key': 'single',
			}, {
				'code_sample': [
					wrap.span.name('{help_code_list_name}') + '[inline]',
					wrap.span.name('{help_code_list_name}') + '[columns]',
				],
				'text_key': 'inline',
			}, {
				'code_sample': [
					wrap.span.name('{help_code_list_name}') + '[newline]',
					wrap.span.name('{help_code_list_name}') + '[rows]',
				],
				'text_key': 'newline',
			},
		],
		'clone': [
			{
				'text_key': 'notes',
			}, {
				'code_sample': '[copy={help_clone_alias}]',
				'text_key': 'copy',
				'text_replace_values': ['{help_clone_alias}'],
			}, {
				'code_sample': '[paste={help_clone_alias}]',
				'text_key': 'paste',
				'text_replace_values': ['{help_clone_alias}'],
			}, {
				'code_sample': [
					'[copy]',
					'[paste]',
				],
				'text_key': 'empty_id',
			}, {
				'code_sample': '[copy=A copy=B]',
				'text_key': 'multi_copy',
			}, {
				'code_sample': '[paste=A paste=B]',
				'text_key': 'multi_paste',
			},
		],
		'collage': [
			{
				'text_key': 'notes',
			}, {
				'code_sample': '[collage={help_code_color_value}/{help_code_color_value}2/({help_code_more_values})]',
				'text_key': 'color',
				'text_replace_values': [getHelpSectionLinkHTML('help_color_value')],
			}, {
				'code_sample': '[collage=border=(0,1,2,5...10)px]',
				'text_key': 'border',
			}, {
				'code_sample': '[collage=padding=(0,1,2,5...10)px]',
				'text_key': 'padding',
			}, {
				'code_sample': '[collage=(0,1,2,5...10)px/({help_code_more_numbers})px]',
				'text_key': 'pixels',
			//* TODO:
			// }, {
				// 'code_sample': '[collage=top-left/top-right/bottom-left/bottom-right/top/bottom/left/right]',
				// 'text_key': 'align',
			// }, {
				// 'code_sample': '[collage=all/etc]',
				// 'text_key': 'all',
			}, {
				'code_sample': '[collage]',
				'text_key': 'default',
				'text_replace_values': [
					getTableHTML(
						{
							'cell_tag_name': 'th',
							'cells': [
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
		'color_value': [
			{
				'text_key': 'notes',
				'text_replace_values': [
					getCodeTableHTML(
						{
							'cell_tag_name': 'th',
							'cells': [
								'{help_color_value_table_short_hex}',
								'{help_color_value_table_split_hex}',
								'{help_color_value_table_split_dec}',
							],
						}, [
							'[#1]',
							'[hex=11-11-11]',
							'[rgb=17-17-17]',
						], [
							'[#12]',
							'[hex=12-12-12]',
							'[rgb=18-18-18]',
						], [
							'[#123]',
							'[hex=11-22-33]',
							'[rgb=17-34-51]',
						], [
							'[#1234]',
							'[hex=11-22-33-44]',
							'[rgba=17-34-51-68]',
						], [
							'[#12345]',
							'[hex=12-34-5]',
							'[rgb=18-52-5]',
						], [
							'[#123456]',
							'[hex=12-34-56]',
							'[rgb=18-52-86]',
						], [
							'[#1234567]',
							'[hex=12-34-56-7]',
							'[rgba=18-52-86-7]',
						], [
							'[#12345678]',
							'[hex=12-34-56-78]',
							'[rgba=18-52-86-120]',
						],
					),
					getHelpSectionLinkAwayHTML('help_color_value_names_link'),
				],
			}, {
				'code_sample': [
					'[rgb=10-20-30]',
					'[rgba=0-100-200-255]',
					'[rgba(0,100,200,255)]',
				],
				'text_key': 'split_dec',
			}, {
				'code_sample': [
					'[hex=12-34-56]',
					'[hex=12-34-ab-cd]',
					'[hex(12,34,ab,cd)]',
				],
				'text_key': 'split_hex',
			}, {
				'code_sample': '[#1234abcd]',
				'text_key': 'short_hex',
			}, {
				'code_sample': '[transparent]',
				'text_key': 'transparent',
				'text_replace_values': [wrap.code.param('[rgba(0,0,0,0)]')],
			},
		],
		'colors': [
			{
				'text_key': 'notes',
				'text_replace_values': [
					getTableHTML(
						[
							'{help_code_list_folder}:',
							[
								'<code>',
									wrap.span.folder(),
									wrap.span.param('[colors]'),
									wrap.span.name('{help_code_list_name_colors}'),
								'</code>',
							],
						], [
							'{help_code_option_layer}:',
							[
								'<code>',
									wrap.span.nested(),
									wrap.span.name('{help_code_option_name_color} 1'),
									wrap.span.param('[red]'),
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
									wrap.span.param('[green]'),
								'</code>',
							],
						], [
							'{help_code_option_inverted}:',
							[
								'<code>',
									wrap.span.nested(),
									wrap.span.param('[not]'),
									wrap.span.name('{help_code_option_name_color} 1'),
									wrap.span.param('[blue]'),
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
				'code_sample': [
					[
						'[colors]',
						wrap.span.name('{help_code_list_name} 1, 2'),
						wrap.span.path('/'),
						wrap.span.name('{help_code_option_name} 1, 2'),
						'[red]',
					],
				],
				'text_key': 'add',
			}, {
				'code_sample': [
					[
						'[colors]',
						wrap.span.name('{help_code_list_name}'),
						wrap.span.path('/'),
						wrap.span.comment('({help_code_more_folders})'),
						wrap.span.path('/'),
						wrap.span.name('{help_code_option_name}'),
						'[green]',
					],
				],
				'text_key': 'nested',
			}, {
				'code_sample': [
					[
						'[colors]',
						wrap.span.name('{help_code_list_name_colors}'),
						wrap.span.path('/'),
						'[if parts]',
						wrap.span.name('{help_code_list_name_parts}'),
						wrap.span.path('/'),
						wrap.span.name('{help_code_option_name_part}'),
						wrap.span.path('/'),
						wrap.span.name('{help_code_option_name_color_same}'),
						'[blue]',
					], [
						'[colors]',
						wrap.span.name('{help_code_list_name_colors}'),
						wrap.span.path('/'),
						'[not]',
						wrap.span.name('{help_code_option_name_color_same}'),
						'[gray]',
					], [
						'[colors]',
						wrap.span.name('{help_code_list_name_colors}'),
						wrap.span.path('/'),
						wrap.span.comment('({help_code_otherwise})'),
						wrap.span.name('{help_code_option_name_color_same}'),
						'[dark-blue]',
					],
				],
				'text_key': 'path_logic',
				'text_replace_values': [
					wrap.code.param('[not]'),
					wrap.code.param('[if]'),
					getHelpSectionLinkHTML('help_path_logic'),
				],
			},
		],
		'opacity': [
			{
				'text_key': 'notes',
			}, {
				'code_sample': [
					[
						wrap.span.name('{help_code_list_name}'),
						'[opacity=0/10/20/({help_code_more_numbers})/100%]',
					], [
						wrap.span.name('{help_code_list_name} 1, 2'),
						'[0/10/20/({help_code_more_numbers})/100%]',
					],
				],
				'text_key': 'set',
				'text_replace_values': [
					wrap.code.param('[optional]'),
					getHelpSectionLinkHTML('help_other'),
				],
			},
		],
		'other': [
			{
				'code_sample': [
					[
						'[optional parts]',
						wrap.span.name('{help_code_list_name}'),
					], [
						'[optional colors]',
						wrap.span.name('{help_code_list_name}'),
					], [
						'[optional zoom=25/50%]',
					],
				],
				'text_key': 'optional',
			}, {
				'code_sample': [
					[
						'[last parts]',
						wrap.span.name('{help_code_list_name}'),
					], [
						'[last colors]',
						wrap.span.name('{help_code_list_name}'),
					], [
						'[last zoom=100/50%]',
					],
				],
				'text_key': 'last',
			}, {
				'code_sample': [
					[
						'[initial]',
						wrap.span.name('{help_code_option_name}'),
					], [
						'[preselect]',
						wrap.span.name('{help_code_option_name}'),
					], [
						'[parts]',
						wrap.span.name('{help_code_list_name}'),
						wrap.span.path('/'),
						wrap.span.name('{help_code_option_name}'),
						'[preselect]',
					],

				],
				'text_key': 'preselect',
			}, {
				'code_sample': '[no-prefix]' + wrap.span.name('{help_code_list_name}'),
				'text_key': 'no_prefix',
			}, {
				'code_sample': '[no-render]',
				'text_key': 'no_render',
			}, {
				'code_sample': '[skip]',
				'text_key': 'skip',
			},
		],
		'padding': [
			{
				'text_key': 'notes',
			}, {
				'code_sample': [
					wrap.span.name('{help_code_list_name}') + '[outline red 0px 1/2/3px (4,5,6)px]',
					wrap.span.name('{help_code_list_name}') + '[outline red (-1...1)/(5...10)px]',
				],
				'text_key': 'outer_radius',
				'text_replace_values': wrap.code.param('/'),
			}, {
				'code_sample': [
					wrap.span.name('{help_code_list_name}') + '[outline 1:2px]',
					wrap.span.name('{help_code_list_name}') + '[outline ((0,1,2...5):(5...10))px]',
				],
				'text_key': 'inner_radius',
				'text_replace_values': wrap.code.param(':'),
			}, {
				'code_sample': [
					wrap.span.name('{help_code_list_name}') + '[outline 1x2px]',
				],
				'text_key': 'outer_box',
				'text_replace_values': wrap.code.param('x'),
			}, {
				'code_sample': [
					wrap.span.name('{help_code_list_name}') + '[outline ((1:2)x(3:4))px]',
				],
				'text_key': 'inner_box',
			}, {
				'code_sample': [
					wrap.span.name('{help_code_list_name}') + '[outline 1xpx]',
					wrap.span.name('{help_code_list_name}') + '[outline (x1)px]',
				],
				'text_key': 'outer_square',
			}, {
				'code_sample': [
					wrap.span.name('{help_code_list_name}') + '[outline 1:xpx]',
					wrap.span.name('{help_code_list_name}') + '[outline 1x1:px]',
					wrap.span.name('{help_code_list_name}') + '[outline x((-1...1):(-2...2))px]',
				],
				'text_key': 'inner_square',
			}, {
				'code_sample': [
					wrap.span.name('{help_code_list_name}') + '[outline 1x2:3x4px]',
				],
				'text_key': 'invalid',
				'text_replace_values': [
					wrap.code.param('[outline 1x2:3px]'),
				],
			}, {
				'code_sample': [
					wrap.span.name('{help_code_list_name}') + '[outline at=0,1,2,({help_code_more_numbers})]',
					wrap.span.name('{help_code_list_name}') + '[outline at=5...10]',
				],
				'text_key': 'threshold',
			//* TODO:
			// }, {
				// 'code_sample': [
					// wrap.span.name('{help_code_list_name}') + '[outline max/min]',
				// ],
				// 'text_key': 'method',
			}, {
				'code_sample': [
					wrap.span.name('{help_code_list_name}') + '[outline at=0,5...10,16/(1...2):(3...4)x(5...6):(7...8)px]',
				],
				'text_key': 'cross',
				'text_replace_values': [
					DEFAULT_ALPHA_MASK_PADDING,
					DEFAULT_ALPHA_MASK_THRESHOLD,
				],
			},
		],
		'param': [
			{
				'text_key': 'notes',
				'text_replace_values': [
					getHelpSectionLinkHTML('help_virtual_path'),
					wrap.code.param(' [ {help_param_params} ] '),
					wrap.code.comment(' ( {help_param_comments} ) '),
					wrap.code.name(' {help_param_names} '),
					wrap.code.path(' / '),
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
									wrap.span.param(
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
									wrap.span.param('[{help_code_param}1 {help_code_param}2]'),
									wrap.span.name('{help_code_layer} 1'),
									wrap.span.comment('({help_code_copy} 2)'),
									wrap.span.name('{help_code_name} 2'),
									wrap.span.param('[{help_code_param}3, 4]'),
									wrap.span.name('{help_code_name} 3, 4'),
									wrap.span.comment('({help_code_more_comments})'),
								'</code>',
							],
						],
					),
				],
			},
		],
		'parts': [
			{
				'text_key': 'notes',
				'text_replace_values': [
					getTableHTML(
						[
							'{help_code_list_folder}:',
							[
								'<code>',
									wrap.span.folder(),
									wrap.span.param('[parts]'),
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
									wrap.span.param('[not]'),
									wrap.span.name('{help_code_option_name_part} 1'),
								'</code>',
							],
						],
					),
				],
			}, {
				'code_sample': [
					[
						'[parts]',
						wrap.span.name('{help_code_list_name} 1, 2'),
						wrap.span.path('/'),
						wrap.span.name('{help_code_option_name} 1, 2'),
					],
				],
				'text_key': 'add',
				'text_replace_values': [
					wrap.code.param('[not]'),
					wrap.code.param('[if]'),
					getHelpSectionLinkHTML('help_path_logic'),
				],
			},
		],
		'path_logic': [
			{
				'text_key': 'notes',
				'text_replace_values': [wrap.code.param('[if]')],
			}, {
				'code_sample': [
					[
						'[if parts]',
						wrap.span.name('{help_code_list_name}'),
						wrap.span.path('/'),
						wrap.span.name('{help_code_option_name}'),
					], [
						'[if colors]',
						wrap.span.name('{help_code_list_name}'),
						wrap.span.path('/'),
						wrap.span.name('{help_code_option_name}'),
					],
				],
				'text_key': 'if',
			}, {
				'code_sample': [
					[
						'[if parts]',
						wrap.span.name('{help_code_list_name}'),
						wrap.span.path('/'),
						'[not]',
						wrap.span.name('{help_code_option_name}'),
					], [
						'[if colors]',
						wrap.span.name('{help_code_list_name}'),
						wrap.span.path('/'),
						'[not]',
						wrap.span.name('{help_code_option_name}'),
					],
				],
				'text_key': 'if_not_option',
			}, {
				'code_sample': [
					[
						'[if not parts]',
						wrap.span.name('{help_code_list_name}'),
						wrap.span.path('/'),
						wrap.span.name('{help_code_option_name}'),
					], [
						'[if not colors]',
						wrap.span.name('{help_code_list_name}'),
						wrap.span.path('/'),
						wrap.span.name('{help_code_option_name}'),
					],
				],
				'text_key': 'if_not_list',
				'text_replace_values': [wrap.code.param('[not]')],
			}, {
				'code_sample': [
					[
						'[if not parts]',
						wrap.span.name('{help_code_list_name}'),
						wrap.span.path('/'),
						'[not]',
						wrap.span.name('{help_code_option_name}'),
					], [
						'[if not colors]',
						wrap.span.name('{help_code_list_name}'),
						wrap.span.path('/'),
						'[not]',
						wrap.span.name('{help_code_option_name}'),
					],
				],
				'text_key': 'if_not_both',
				'text_replace_values': [wrap.code.param('[not]')],
			}, {
				'code_sample': [
					[
						'[if parts]',
						wrap.span.name('{help_code_list_name}'),
						wrap.span.path('/'),
						'[not none]',
					], [
						'[if colors]',
						wrap.span.name('{help_code_list_name}'),
						wrap.span.path('/'),
						'[not none]',
					], [
						'[if any parts]',
						wrap.span.name('{help_code_list_name} 1, 2'),
					], [
						'[if any colors]',
						wrap.span.name('{help_code_list_name} 1, 2'),
					],
				],
				'text_key': 'if_any',
			}, {
				'code_sample': [
					[
						'[if parts]',
						wrap.span.name('{help_code_list_name}'),
						wrap.span.path('/'),
						'[none]',,
					], [
						'[if colors]',
						wrap.span.name('{help_code_list_name}'),
						wrap.span.path('/'),
						'[none]',
					], [
						'[if not any parts]',
						wrap.span.name('{help_code_list_name} 1, 2'),
					], [
						'[if not any colors]',
						wrap.span.name('{help_code_list_name} 1, 2'),
					],
				],
				'text_key': 'if_not_any',
				'text_replace_values': [wrap.code.param('[not]')],
			}, {
				'code_sample': '[not]',
				'text_key': 'not',
				'text_replace_values': [
					wrap.code.param('[if]'),
					wrap.code.param('[any]'),
				],
			}, {
				'code_sample': '[any]',
				'text_key': 'any',
				'text_replace_values': [wrap.code.param('[if]')],
			}, {
				'code_sample': '[none]',
				'text_key': 'none',
			},
		],
		'separate': [
			{
				'code_sample': '[separate]',
				'text_key': 'notes',
				'text_replace_values': [getHelpSectionLinkHTML('help_clone')],
			},
		],
		'side': [
			{
				'text_key': 'notes',
			}, {
				'code_sample': [
					'[front]',
					'[not back]',
					'[if not reverse]',
				],
				'text_key': 'front',
			}, {
				'code_sample': [
					'[back]',
					'[not front]',
					'[if reverse]',
				],
				'text_key': 'back',
			}, {
				'code_sample': [
					'[reverse]' + wrap.span.comment('({help_code_folder})'),
				],
				'text_key': 'reverse',
			}, {
				'code_sample': '[reverse=hor]',
				'text_key': 'flip_hor',
				'text_replace_values': [wrap.code.param('reverse')],
			}, {
				'code_sample': '[reverse=ver]',
				'text_key': 'flip_ver',
				'text_replace_values': [wrap.code.param('reverse')],
			},
		],
		'virtual_path': [
			{
				'text_key': 'notes',
				'text_replace_values': [
					[
						[
							'{help_code_layer}:&nbsp;',
							'<code>',
								wrap.span.name('{help_code_parent_name}'),
								wrap.span.param('[{help_code_parent_param}]'),
								wrap.span.path('/'),
								wrap.span.name('{help_code_child_name}'),
								wrap.span.param('[{help_code_child_param}]'),
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
									wrap.span.param('[{help_code_parent_param}]'),
								'</code>',
							],
						], [
							'{help_code_layer}:',
							[
								'<code>',
									wrap.span.nested(),
									wrap.span.name('{help_code_child_name}'),
									wrap.span.param('[{help_code_child_param}]'),
								'</code>',
							],
						],
					),
					getHelpSectionLinkHTML('help_clone'),
				],
			},
		],
		'zoom': [
			{
				'code_sample': [
					'[zoom=10/20/({help_code_more_numbers})/100%]',
					'[x10/20/({help_code_more_numbers})/100%]',
				],
				'text_key': 'notes',
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
			'content': getLocalizedHTML('about_notes')
		}
	,	{
			'pretext': '<hr>'
		,	'header': getLocalizedHTML('about_source')
		,	'links': [
				['https://github.com/f2d/sprite_dress_up', 'GitHub']
			]
		}
	,	{
			'header': getLocalizedHTML('about_lang')
		,	'links': (
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

const	toggleTextSizeHTML = (
		'<button'
	+	getTagAttrIfNotEmpty('title', getLocalizedOrEmptyText('larger_text'))
	+	` onclick="return toggleTextSize()">`
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
	+	'<div id="loaded-files-selection"></div>'
	+	'<div id="loaded-files-view"></div>'
	+	toggleTextSizeHTML
	);

	getAllByClass('thumbnail').forEach(
		(element) => {
			if (!element.firstElementChild) {
				setImageSrc(element);
			}
		}
	);

const	linkTooltips = [
		['section-link', 'help_section_link'],
		['local-link', 'page_version_link'],
		['external-link', 'external_link'],
	];

	linkTooltips.forEach(
		([ className, textKey ]) => getAllByClass(className).forEach(
			(element) => {
			const	url = element.getAttribute('href');

				if (url) {
					element.setAttribute('title', decodeURI(getLocalizedText(textKey, url)));
				}
			}
		)
	);

	console.timeEnd(logLabel);

//* enable/disable main menu buttons:

	setGlobalWIPstate(false);

//* add global on-page events:
//* Note: drop event may not work without dragover.

const	eventHandlers = [
		['beforeunload',onBeforeUnload],
		['dragover',	onPageDragOver],
		['drop',	onPageDrop],
		['keydown',	onPageKeyDown],	//* <- 'keypress' ignores Esc key in some modern browsers
		['resize',	onResize],
	];

	eventHandlers.forEach(
		([ eventName, handlerFunction ]) => window.addEventListener(eventName, handlerFunction, false)
	);

//* open or restore state of UI parts:

let	oldSetting;

	if (
		LS
	&&	(oldSetting = LS[LS_KEY_BIG_TEXT])
	&&	!FALSY_STRINGS.includes(oldSetting)
	) {
		toggleTextSize();
	}

	if (OPEN_FIRST_MENU_TAB_AT_START) {
		toggleClass(getAllByTag('header')[0], 'show');

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
