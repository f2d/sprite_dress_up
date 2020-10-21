
//* source file data:
//* TODO: keep all layer-name parameters single-word if possible.
//* TODO: lazy loading only needed images in ORA one by one, as in PSD, after new tree structure is finished.
//* TODO: whole config in JSON-format?

//* menu:
//* TODO: checkbox (on project selection bar?) to sync all option/export actions in selected project onto all opened projects where possible.
//* TODO: zoom format in filenames: [x1, x1.00, x100%].
//* TODO: progress/status panel + [stop operation] button.
//* TODO: options menu: add/remove/copy/edit colors and outlines, or all list(s), maybe in textarea.
//* TODO: remember already calculated batch counts and valid lists per project, in a dict with keys like joined list of all options and checkboxes.
//* TODO: <select multiple> <optgroup> <option>?</option> </optgroup> </select>.
//* TODO: save opened project as restructured ORA/PSD. Try https://github.com/Agamnentzar/ag-psd
//* TODO: save rendered image as WebP. https://bugs.chromium.org/p/chromium/issues/detail?id=170565#c77 - toDataURL/toBlob quality 1.0 = lossless.

//* rendering:
//* TODO: properly check copypaste visibility.
//* TODO: stop images moving to hidden container when save collage button was clicked.
//* TODO: fix hiding of clipping group with skipped/invisible/empty base layer.
//* TODO: keep track of current root of (possibly nested) copy-pasted layer (in array property with push-pop?) while rendering.
//* TODO: decode layer data (PSD/PNG/etc) without using canvas, to avoid precision drop by premultiplied-alpha (PMA - in Firefox, not in Chrome).
//* TODO: arithmetic emulation of all blending operations, not native to JS.
//* TODO: arithmetic emulation of all operations in 16/32-bit until final result; to be optionally available as checkbox/selectbox.
//* TODO: set RGB of zero-alpha pixels to average of all non-zero-alpha neighbour RGB values ignoring alpha.
//* TODO: for files without merged image data - render ignoring options, but respecting layer visibility properties. Or buttons to show embedded and/or rendered image regardless of options. Or add this as top-most option for any project, with or without options.
//* TODO: use ImageBitmaps for speed?
//* TODO: revoke collage blob urls when cleaning view container?
//* TODO: revoke any image blob urls right after image element's loading, without ever tracking/listing them?

//* other:
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
,	DEFAULT_COLLAGE_PADDING = 0
,	DEFAULT_COLLAGE_PADDING_INSIDE = 2
,	DEFAULT_COLLAGE_PADDING_OUTSIDE = 1

,	PREVIEW_SIZE = 64
,	THUMBNAIL_SIZE = 16
,	THUMBNAIL_ZOOM_STEP_MAX_FACTOR = 4	//* <- one-step scaling result is too blocky, stepping by factor of 2 is too blurry, 4 looks okay
,	ZOOM_STEP_MAX_FACTOR = 2

,	ADD_COUNT_ON_BUTTON_LABEL	= false
,	ADD_PAUSE_BEFORE_EACH_FOLDER	= true	//* <- when loading file and rendering
,	ADD_PAUSE_BEFORE_EACH_LAYER	= false
,	DOWNSCALE_BY_MAX_FACTOR_FIRST	= true
,	EXAMPLE_NOTICE			= false
,	FILE_NAME_ADD_PARAM_KEY		= true
,	OPEN_FIRST_MENU_TAB_AT_START	= true
,	TAB_THUMBNAIL_ZOOM		= true
,	TESTING				= false
,	TESTING_RENDER			= false
,	USE_ZLIB_ASM			= true
,	VERIFY_PARAM_COLOR_VS_LAYER_CONTENT	= false
,	ZERO_PERCENT_EQUALS_EMPTY		= false
	;

//* Config: internal, do not change *------------------------------------------

const	configFilePath = 'config.js'			//* <- declarations-only file to redefine any of the above variables
,	fetchTestFilePath = 'index.png'			//* <- smallest local file to test loading from disk
,	localStorageNameSpace = 'spriteDressUp'
,	LSKeyBigText = localStorageNameSpace + 'BigText'

// ,	regLayerNameToSkip		= /^(skip)$/i
,	regLayerNameToSkip		= null
,	regLayerNameParamOrComment	= new RegExp(
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
// ,	regLayerNameParamSplit	= /[\s,_]+/g
,	regLayerNameParamSplit	= /[\s\r\n]+/g
,	regLayerNameParamTrim	= getTrimReg('\\s\\r\\n,_')
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
,	regSplitLayerNames	= /[\/,]+/g
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
,	regClassOption		= getClassReg('project-option|option')
,	regClassExampleFiles	= getClassReg('example-file-type|example-files|files')
,	regClassExampleFile	= getClassReg('example-file|file')
,	regClassLoadedFile	= getClassReg('loaded-file|file')
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

const	LS = window.localStorage || localStorage
,	URL = window.URL || window.webkitURL || URL
,	LANG = document.documentElement.lang || 'en'

,	CAN_CAST_TO_ARRAY = (typeof Array.from === 'function')
,	CAN_EXPORT_BLOB = (typeof HTMLCanvasElement.prototype.toBlob === 'function')
,	CAN_EXPORT_WEBP = isImageTypeExportSupported('image/webp')
,	RUNNING_FROM_DISK = isURLFromDisk('/')

,	SPLIT_SEC = 60
,	MIN_CHANNEL_VALUE = 0
,	MAX_CHANNEL_VALUE = 255
,	MAX_OPACITY = 255
,	MAX_BATCH_PRECOUNT = 1000

,	FLAG_FLIP_HORIZONTAL = 1
,	FLAG_FLIP_VERTICAL = 2

,	FLAG_EVENT_STOP_IMMEDIATE = {stopImmediatePropagation: true}
,	FLAG_EVENT_NO_DEFAULT = {preventDefault: true}

,	DUMMY_ARRAY = [null]	//* <- for cross-product combinations

,	BLOB_PREFIX = 'blob:'
,	DATA_PREFIX = 'data:'
,	TYPE_TEXT = 'text/plain'

,	TIME_PARTS_YMD = ['FullYear', 'Month', 'Date']
,	TIME_PARTS_HMS = ['Hours', 'Minutes', 'Seconds']

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

,	PROJECT_CONTROLS = [
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

,	CLEANUP_KEYS_TESTING = [
		'loading'
	,	'toPng'
	]

,	CLEANUP_KEYS = CLEANUP_KEYS_TESTING.concat([
		'blendModeOriginal'
	,	'nameOriginal'
	,	'sourceData'
	,	'maskData'
	])

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
	];

//* Config: internal, loaders of project files *-------------------------------

const	libRootDir = 'lib/'
,	libFormatsDir = libRootDir + 'formats/'

//* source: https://github.com/ukyo/zlib-asm

,	zlibAsmSubDir = 'zlib-asm/v0.2.2/'	//* <- last version supported by zip.js, ~ x2 faster than default
// ,	zlibAsmSubDir = 'zlib-asm/v1.0.7/'	//* <- not supported by zip.js, works in some cases (with same speed as v0.2.2)

,	fileTypeLibs = {
		'UPNG.js': {

//* source: https://github.com/photopea/UPNG.js

			'varName': 'UPNG'
		,	'dir': libFormatsDir + 'png/'
		,	'files': [
				'pako/pako.js',
				'UPNG/UPNG.js',
			]
		},

		'zip.js': {

//* source: https://github.com/gildas-lormeau/zip.js

			'varName': 'zip'
		,	'dir': libFormatsDir + 'zip/zip_js/'
		,	'files': [
				'zip.js',
				'zip-fs.js',

//* CORS workaround: https://github.com/gildas-lormeau/zip.js/issues/169#issuecomment-312110395

			].concat(RUNNING_FROM_DISK ? (
				USE_ZLIB_ASM
				? [
					zlibAsmSubDir + 'zlib.js',
					'zlib-asm/codecs.js',
				]
				: [
					'inflate.js',
					'deflate.js',
				]
			) : [])
		},

		'ora.js': {

//* source: https://github.com/zsgalusz/ora.js

//* no support for ORA in CSP, SAI, etc.
//* not enough supported features in Krita, etc.

//* way: draw in SAI2 → export PSD → import PSD in Krita (loses clipping groups) → export ORA (loses opacity masks)
//* wish: draw in SAI2 → export ORA (all layers rasterized + all blending properties and modes included as attributes)

			'varName': 'ora'
		,	'dir': libFormatsDir + 'ora/ora_js/'
		,	'files': [
				'ora.js',
				// 'ora-blending.js',
			]
		,	'depends': [
				'zip.js',
			]
		},

		'psd.js': {

//* source: https://github.com/meltingice/psd.js
//* based on https://github.com/layervault/psd.rb

			'varName': 'PSD_JS'
		,	'dir': libFormatsDir + 'psd/psd_js/'
		,	'files': [
				// 'psd.min.js',
				'psd.js',
			]
		},

		'psd.browser.js': {

//* source: https://github.com/imcuttle/psd.js/tree/release
//* fork of https://github.com/meltingice/psd.js

			'varName': 'PSD'
		,	'dir': libFormatsDir + 'psd/psd_browser/'
		,	'files': [
				// 'psd.browser.min.js',
				'psd.browser.js',
			]
		},
	}
,	fileTypeLoaders = [
		{
			'dropFileExts': ['ora', 'zip']
		,	'handlerFuncs': [
				loadORA,
			]
		},
		{
			'dropFileExts': ['psd']
		,	'handlerFuncs': [
				// loadPSD,
				loadPSDBrowser,
			]
		},
	];

//* To be figured on the go *--------------------------------------------------

var	ora, zip, PSD, UPNG	//* <- external variable names, do not change

,	PSD_JS
,	CompositionModule
,	CompositionFuncList

,	DEFAULT_COLLAGE
,	thumbnailPlaceholder
,	canLoadFromDisk
,	isStopRequested
,	isBatchWIP
	;

//* Common utility functions *-------------------------------------------------

function isNonNullObject(value) {
	return (
		value !== null
	&&	typeof value === 'object'
	);
}

//* Create type-checking functions, e.g. "isString()" or "isImageElement()":
//* source: https://stackoverflow.com/a/17772086
[
	'Array',
	'Date',
	'Function',
	'Number',
	'String',
	'HTMLCanvasElement',
	'HTMLImageElement',
	'HTMLSelectElement',
].forEach(
	(typeName) => {
		window[
			'is' + typeName.replace('HTML', '')
		] = function(value) {
			return (toString.call(value).slice(8, -1) === typeName);
		};
	}
);

//* Get array of all possible combinations of values from multiple arrays:
//* source: https://cwestblog.com/2011/05/02/cartesian-product-of-multiple-arrays/
//* usage:
//*	var combos = getCrossProductArray( array, array, ... );
//*	var combo = combos[123];
//*	var count = combos.length;
function getCrossProductArray() {
	return Array.prototype.reduce.call(
		arguments
	,	(a, b) => {
		var	result = [];

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

//* Construct lazy iterator for all possible combinations without saving them all beforehand:
//* source: http://phrogz.net/lazy-cartesian-product
//* usage:
//*	var combos = new CrossProductIterator( array, array, ... );
//*	var combo = combos.item(123);
//*	var count = combos.length;
function CrossProductIterator() {
	for (
	var	dimensions = [], totalCount = 1, subCount, argIndex = arguments.length;
		argIndex--;
		totalCount *= subCount
	) {
		dimensions[argIndex] = [totalCount, subCount = arguments[argIndex].length];
	}

	this.length = totalCount;

	this.item = (comboIndex) => {
		for (
		var	combo = [], argIndex = arguments.length;
			argIndex--;
		) {
			combo[argIndex] = arguments[argIndex][(comboIndex / dimensions[argIndex][0] << 0) % dimensions[argIndex][1]];
		}

		return combo;
	};
}

//* Iterate through all possible combinations without saving them all, combination array becomes arguments for callback:
//* source: http://phrogz.net/lazy-cartesian-product
//* usage:
//*	forEachSetInCrossProduct( [array, array, ...], console.log );
function forEachSetInCrossProduct(arrays, callback, thisContext) {

	function dive(arrayIndex) {
	var	variants = arrays[arrayIndex]
	,	count = counts[arrayIndex]
		;

		if (arrayIndex == lastArrayIndex) {
			for (let i = 0; i < count; ++i) {
				variantSet[arrayIndex] = variants[i];
				callback.apply(thisContext, variantSet);
			}
		} else {
			for (let i = 0; i < count; ++i) {
				variantSet[arrayIndex] = variants[i];
				dive(arrayIndex + 1);
			}
		}

		variantSet.pop();
	}

	if (!thisContext) {
		thisContext = this;
	}

var	lastArrayIndex = arrays.length - 1
,	variantSet = []
,	counts = []
	;

	for (let i = arrays.length; i--; ) {
		counts[i] = arrays[i].length;
	}

	dive(0);
}

function asArray(value) {
	if (isArray(value)) {
		return value;
	}

	return [value];
}

function getFlatArray(array, maxDepth) {
	if (isNaN(maxDepth)) {
		maxDepth = Infinity;
	}

var	flatArray = [];

	array.forEach(
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
function getAlphaDataIndex(x,y, width) {return (((y*width + x) << 2) | 3);}
// function getAlphaDataIndex(x,y, width) {return (((y*width + x) * 4) + 3);}
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
	if (values.indexOf(value) < 0) {
		values.push(value);

		return 1;
	}

	return 0;
}

function addRangeToList(values, newValuesText) {
	String(newValuesText)
	.split(regCommaSpace)
	.forEach(
		(rangeText) => {
		var	range = (
				String(rangeText)
				.split(regMultiDot)
				.map((textPart) => textPart.replace(regTrimNaNorSign, ''))
				.filter(arrayFilterNonEmptyValues)
				.map(orzFloat)
			);

			if (range.length > 0) {
			var	min = Math.min(...range)
			,	max = Math.max(...range)
			,	isCountDown = range.indexOf(min) > range.indexOf(max)
				;

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
var	foundValue;

	if (value) {
		return value;
	}

	if (
		(isNumber(index) || isString(index))
	&&	(foundValue = value[index])
	) {
		return foundValue;
	}

	if (
		isFunction(values.find)
	&&	(foundValue = values.find((value) => !!value))
	) {
		return foundValue;
	}

	if (
		isFunction(index.find)
	&&	(foundValue = index.find((value) => !!value))
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

var	wrapText = {
		'prefix': '',
		'suffix': '',
	};

	for (let key in wrapText) if (key in flags) {
		wrapText[key] = String(flags[key]);

		delete flags[key];
	}

	if (isArray(value)) {
	var	joinText = (
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

function getLocalizedKeyByCount(defaultKey, num) {
var	key, keyCase;

	if (
		isFunction(getLocalizedCaseByCount)
	&&	(keyCase = getLocalizedCaseByCount(num))
	&&	(key = defaultKey + '_' + keyCase)
	&&	(key in LOCALIZATION_TEXT)
	) {
		return key;
	}

	return defaultKey;
}

function getLocalizedOrDefaultText(key, defaultText, ...replacements) {
var	lowKey
,	text = getJoinedOrEmptyText(
		key in LOCALIZATION_TEXT
		? LOCALIZATION_TEXT[key]
		: (
			(lowKey = String(key).toLowerCase()) in LOCALIZATION_TEXT
			? LOCALIZATION_TEXT[lowKey]
			: (
				defaultText === true
				? getNestedJoinedText(key, '\n', '')
				: defaultText
			)
		)
	);

	if (
		text
	&&	isArray(replacements)
	) {
		replacements.forEach(
			(value, index) => {
				text = replaceAll(text, '{' + index + '}', getNestedJoinedText(value, '\n', ''));
			}
		);
	}

	if (
		text
	&&	(replacements = text.match(regTemplateVarName))
	) {
		for (let placeholder of replacements) {
			key = placeholder.replace(regTrimBrackets, '');

			if (key in LOCALIZATION_TEXT) {
				text = replaceAll(text, placeholder, getNestedJoinedText(LOCALIZATION_TEXT[key], '\n', ''));
			} else
			if (key in window) {
				text = replaceAll(text, placeholder, getNestedJoinedText(window[key], '\n', ''));
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
	return new Promise(
		(resolve, reject) => {
			setTimeout(resolve, msec || 1000);
		}
	);
}

function eventStop(evt, flags) {
	if (
		(
			evt
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

		for (let key in flags) {
			if (flags[key] && isFunction(evt[key])) evt[key]();
		}
	}

	return evt;
}

function getErrorFromEvent(evt, message, callback) {
var	error = new Error(message || 'Unknown error');
	error.event = evt;

	if (isFunction(callback)) callback(error);

	return error;
}

function isURLFromDisk(url) {
var	match = url.match(/^(\w+):(\/\/|$)/)
,	protocol = (
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
var	canvas = cre('canvas');
	canvas.width = 1;
	canvas.height = 1;

	return (
		canvas
		.toDataURL(type)
		.indexOf(type) >= 0
	);
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

var	text = String(text).replace(regNonHex, '')
,	charsNum = text.length
	;

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

var	rgba = [0,0,0,255];

	for (let index = 0; index < rgba.length && text.length > 0; index++) {
		charsNum = Math.min(2, text.length);
		rgba[index] = parseInt(text.substr(0, charsNum), 16);
		text = text.substr(charsNum);
	}

	return rgba;
}

function getRGBAFromColorCodeMatch(match) {
var	rgba = [0,0,0,255];

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
var	match = String(color).match(regColorCode);

	if (match) {
		return getRGBAFromColorCodeMatch(match);
	}
}

function getRGBAFromColorCodeOrName(color, maxCount) {
var	rgba = getRGBAFromColorCodeText(color);

	if (rgba) {
		return rgba;
	}

//* ask browser built-in API what a color word means:

var	canvas = cre('canvas')
,	ctx = canvas.getContext('2d')
,	normalizedColorText = getNormalizedColorText(color)
,	rgbaFromCanvas
	;

	canvas.width = 1;
	canvas.height = 1;
	ctx.fillStyle = 'transparent';
	ctx.fillStyle = normalizedColorText;

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
var	[r, g, b] = getRGBAFromColorCodeOrArray(color, 3);

//* sources:
//* https://awik.io/determine-color-bright-dark-using-javascript/
//* http://alienryderflex.com/hsp.html
	return Math.sqrt(
		0.299 * (r * r)
	+	0.587 * (g * g)
	+	0.114 * (b * b)
	) < 150;
}

function isColorTransparent(color) {
	if (getNormalizedColorText(color) === 'transparent') {
		return true;
	}

var	rgba = getRGBAFromColorCodeOrArray(color);

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
	var	rgba = rgba.slice(0, orzClamp(maxCount || 4, 1,4)).map(
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

function getOrInitChild() {

	function getInitChild(args) {
	var	constructor = args.find(isFunction) || Object
	,	keys = args.filter(isString)
		;

		if (keys.length > 0) {
		var	child = {};

			while (keys.length > 0) {
			var	key = keys.shift();
				child[key] = new constructor();
			}
		} else {
			child = new constructor();
		}

		return child;
	}

var	args = Array.from(arguments)
,	obj = args.shift()
,	key = args.shift()
	;

	if (!isNonNullObject(obj)) {
		return;
	}

	return (
		key in obj
		? obj[key]
		: (obj[key] = getInitChild(args))
	);
}

function getPropByNameChain() {
var	keys = Array.from(arguments)
,	obj = keys.shift()
	;

	while (keys.length > 0) {
	var	key = keys.shift();

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

function getPropByAnyOfNamesChain() {
var	keys = Array.from(arguments)
,	obj = keys.shift()
	;

	deeper:
	while (isNonNullObject(obj)) {

		for (let key of keys) if (key in obj) {
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
	if (obj) {
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
			var	child = obj[key];
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
var	SIZE_64_KB = 65536	// 0x10000
,	SIZE_64_MB = 67108864	// 0x4000000
	;

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
	var	results = (
			isFunction(parent[by])
			? parent[by](text)
			: parent.querySelectorAll(QUERY_SELECTOR[by].join(text))
		) || [];

		return (
			CAN_CAST_TO_ARRAY
			? Array.from(results)
			: Array.prototype.slice.call(results)
		);
	} catch (error) {
		logError(arguments, error);
	}

	return [];
}

function gc(text, parent) {return getElementsArray('getElementsByClassName', text, parent);}
function gt(text, parent) {return getElementsArray('getElementsByTagName', text, parent);}
function gy(text, parent) {return getElementsArray('getElementsByType', text, parent);}
function gn(text, parent) {return getElementsArray('getElementsByName', text, parent);}
function gi(text, parent) {return getElementsArray('getElementsById', text, parent);}
function id(text) {return document.getElementById(text);}

function cre(tagName, parent, before) {
var	element = document.createElement(tagName);

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

	if (isFunction(element.map)) {
		return element.map(del);
	}

var	parent = element.parentNode;
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
var	helperObject;

	if (helperObject = element.currentStyle) {
		return helperObject[dashedToCamelCase(prop)];
	}

	if (helperObject = window.getComputedStyle) {
		return helperObject(element).getPropertyValue(prop);
	}

	return null;
}

function toggleClass(element, className, keep) {
	if (!className || !element) return;

var	keep = orz(keep)
,	oldText = element.className || element.getAttribute('className') || ''
,	classNames = oldText.split(regSpace).filter(arrayFilterNonEmptyValues)
,	index = classNames.indexOf(className)
	;

	if (index < 0) {
		if (keep >= 0) classNames.push(className);
	} else {
		if (keep <= 0) classNames.splice(index, 1);
	}

	if (classNames.length > 0) {
	var	newText = classNames.join(' ');
		if (oldText != newText) element.className = newText;
	} else
	if (oldText) {
		element.className = '';
		element.removeAttribute('className');
	}

	return (classNames.indexOf(className) >= 0);
}

function getClassReg(className) {return new RegExp('(^|\\s)(' + className + ')($|\\s)', 'i');}
function getTrimReg(chars) {return new RegExp('^[' + chars + ']+|[' + chars + ']+$', 'gi');}

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
var	regClassName = (className.test ? className : getClassReg(className));

	while (element && (element = element.previousElementSibling)) {
		if (element.className && regClassName.test(element.className)) {
			break;
		}
	}

	return element;
}

function getNextSiblingByClass(element, className) {
var	regClassName = (className.test ? className : getClassReg(className));

	while (element && (element = element.nextElementSibling)) {
		if (element.className && regClassName.test(element.className)) {
			break;
		}
	}

	return element;
}

function getThisOrParentByClass(element, className) {
var	regClassName = (className.test ? className : getClassReg(className));

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
var	tagName = String(tagName || '') || 'td'
,	openTag = '<' + tagName + '>'
,	closeTag = '</' + tagName + '>'
	;

	return (
		openTag
	+		getNestedJoinedText(cells, closeTag + openTag, '')
	+	closeTag
	);
}

function getTableHTML() {
	return (
		'<table><tr>'
	+	Array.from(arguments).map(
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

var	tagName = tagName || 'div'
,	openTag = '<' + tagName + ' class="'
,	closeTag = '</' + tagName + '>'
,	headContent = String(headContent)
	;

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
	gc('menu-head', getThisOrParentByClass(element, regClassMenuBar)).forEach(
		(tabContainer) => {
		var	header = gt('header', tabContainer)[0];

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
	var	wasOpen = regClassShow.test(header.className);

		toggleClass(header,  'show',   isActionOpen ?  1 : isActionClose ? -1 : 0);
		toggleClass(element, 'hidden', isActionOpen ? -1 : isActionClose ?  1 : 0);

	var	justOpened = !wasOpen && regClassShow.test(header.className);

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
		while (element) {
			if (header) {
				toggleSectionClass(header, element);

				++toggledCount;
			}

		var	header = (element.tagName === tagName ? element : null);

			element = element.nextElementSibling;
		}
	}

var	header = getThisOrParentByTagName(element, 'header');

	if (header) {
	var	actionWords = (action || element.name || '').split('_')
	,	isActionAll = (actionWords.indexOf('all') >= 0)
	,	isActionOpen = (actionWords.indexOf('open') >= 0)
	,	isActionClose = (actionWords.indexOf('close') >= 0)
	,	tagName = header.tagName
	,	toggledCount = 0
		;

		if (isActionAll) {
			gt('section', header.parentNode).forEach(
				(section) => toggleAllSections(gt('header', section)[0])
			);

			if (!toggledCount) {
				toggleAllSections(header);
			}
		} else {
			toggleSectionClass(header, header.nextElementSibling);
		}
	}

	updateDropdownMenuPositions();
}

function showHelpSection(sectionName, source) {
var	header = id('top-menu-' + sectionName);

	if (header) {
		toggleSection(header, 'open');

		if (source) {
		var	sourceElement = (isString(source) ? id('top-menu-' + source) : source)
		,	fromSection = getThisOrParentByTagName(sourceElement, 'section')
		,	toSection = getThisOrParentByTagName(header, 'section')
		,	alignWithTop = true
			;

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
var	isBigTextEnabled = toggleClass(document.body, 'larger-text');

	updateDropdownMenuPositions();

	if (LS) {
		LS[LSKeyBigText] = isBigTextEnabled;
	}
}

function getOffsetXY(element) {
var	x = 0
,	y = 0
	;

	while (element) {
		x += element.offsetLeft;
		y += element.offsetTop;
		element = element.offsetParent;
	}

	return {x:x, y:y};
}

function putInView(element, x,y, changeOnlyX, changeOnlyY) {
var	parentOffsetX = 0
,	parentOffsetY = 0
,	viewport = window.visualViewport
,	positionType = getStyleValue(element, 'position')
,	isPositionFixed = (positionType === 'fixed')
	;

	if (positionType === 'absolute') {
	var	offset = getOffsetXY(element.offsetParent);
		parentOffsetX = offset.x;
		parentOffsetY = offset.y;
	}

	if (isNaN(x)) {
	var	offset = getOffsetXY(element);
		x = offset.x;
		y = offset.y;
	} else {
		x = orz(x) + parentOffsetX;
		y = orz(y) + parentOffsetY;
	}

	if (!changeOnlyY) {
	var	xMin = orz(isPositionFixed ? (document.body.scrollLeft || document.documentElement.scrollLeft) : 0)
	,	xMax = xMin + (viewport ? viewport.width : window.innerWidth) - element.offsetWidth
		;

		if (x > xMax) x = xMax;
		if (x < xMin) x = xMin;

		element.style.left = (x - parentOffsetX) + 'px';
	}

	if (!changeOnlyX) {
	var	yMin = orz(isPositionFixed ? (document.body.scrollTop || document.documentElement.scrollTop) : 0)
	,	yMax = yMin + (viewport ? viewport.height : window.innerHeight) - element.offsetHeight
		;

		if (y > yMax) y = yMax;
		if (y < yMin) y = yMin;

		element.style.top  = (y - parentOffsetY) + 'px';
	}

	return element;
}

function getNumbersArray(data, maxCount, splitBy, transformFunction) {
	if (isSlicableNotString(data)) {
	var	values = Array.from(
			data
			.slice(0, orz(maxCount) || Infinity)
		);
	} else {
		values = (
			String(data)
			.split(splitBy || regNaN, orz(maxCount) || -1)
			.filter(isNotEmptyString)
		);
	}

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

function getFileExt(name) {return name.split(/\./g).pop().toLowerCase();}
function getFileName(path) {return path.split(/\//g).pop();}
function getFileBaseName(name) {var index = name.lastIndexOf('.'); return (index > 0 ? name.substr(0, index) : name);}
function getFilePathFromUrl(url) {return url.split(/\#/g).shift().split(/\?/g).shift();}
function getFormattedFileNamePart(name) {return (name ? '[' + name + ']' : '');}

function getFormattedFileSize(shortened, bytes) {
	if (bytes) {
		bytes += ' ' + getLocalizedText('file_bytes');
	}

	if (shortened && bytes) {
		shortened += ' (' + bytes + ')';
	}

	return shortened || bytes;
}

function leftPadNum(numValue, padToLength, paddingText) {
var	text = String(orz(numValue));
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

var	offset = date.getTimezoneOffset();

	if (offset) {
		if (offset < 0) {
			offset = -offset;
		var	sign = '+';
		} else {
			sign = '-';
		}

	var	offsetHours = leftPadNum(Math.floor(offset / SPLIT_SEC))
	,	offsetMinutes = leftPadNum(offset % SPLIT_SEC)
		;

		return sign + offsetHours + ':' + offsetMinutes;
	} else {
		return 'Z';
	}
}

function getFormattedHMS(msec) {
var	msec = orz(msec)
,	sign = (msec < 0?'-':'')
,	values = [0, 0, Math.floor(Math.abs(msec) / 1000)]
,	index = values.length
	;

	while (--index) {
		if (values[index] >= SPLIT_SEC) {
			values[index - 1] = Math.floor(values[index] / SPLIT_SEC);
			values[index] %= SPLIT_SEC;
		}
		if (values[index] < 10) values[index] = '0' + values[index];
	}

	return sign + values.join(':');
}

function getFormattedTime() {

	function getDatePartText(name) {
	var	num = date['get' + name]();
		if (name === 'Month') ++num;

		return leftPadNum(num);
	}

//* check arguments out of order:

var	flags = {}
,	arg, date
	;

	for (let index in arguments) if (arg = arguments[index]) {
		if (isDate(arg)) var argDate = arg; else
		if (isNumber(arg)) var argNum = arg; else
		if (isString(arg)) var argText = arg; else
		if (isNonNullObject(arg)) {
			for (let key in arg) {
				flags[key] = !!arg[key];
			}
		}

		// if (TESTING) console.log([index + ': ' + typeof arg, arg]);
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

var	textParts = [];

	if (
		flags.onlyYMD
	||	!flags.onlyHMS
	) {
	var	YMD = (
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
	var	HMS = (
			TIME_PARTS_HMS
			.map(getDatePartText)
			.join(flags.fileNameFormat ? '-' : ':')
		);

		if (flags.logFormat) {
		var	msec = (
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

function logTime(argName, argValue) {
var	text = getLogTime();

	if (typeof argName !== 'undefined') {
		text += ' - ' + argName;
	}

	if (typeof argValue !== 'undefined') {
	var	textValue = getJoinedOrEmptyText(argValue, '\n');

		if (textValue.indexOf('\n') >= 0) {
			if (
				hasFraming(textValue, '(', ')')
			||	hasFraming(textValue, '{', '}')
			||	hasFraming(textValue, '[', ']')
			) {
				text += ':\n' + textValue;
			} else {
				text += ':\n[\n' + textValue + '\n]';
			}
		} else {
			text += ' = "' + textValue + '"';
		}
	}

	console.log(text);
}

function logError(args, error) {
	console.log(['Error in "' + args.callee.name + '" with arguments:', args, error]);
}

function getFilePromise(file) {

//* Note: "file" may be a blob object.
//* source: https://stackoverflow.com/a/15981017

	return new Promise(
		(resolve, reject) => {
		var	reader = new FileReader();

			reader.addEventListener(
				'error'
			,	(evt) => getErrorFromEvent(evt, 'FileReader failed.', reject)
			);

			reader.addEventListener(
				'load'
			,	(evt) => {
				var	result = evt.target.result;

					if (result) {
						resolve(result);
					} else {
						getErrorFromEvent(evt, 'FileReader completed, got empty or no result.', reject);
					}
				}
			);

			reader.readAsArrayBuffer(file);
		}
	);
}

function getFilePromiseFromURL(url, responseType) {

//* Note: "url" may be a "blob:" or "data:" url.
//* source: https://www.mwguy.com/decoding-a-png-image-in-javascript/

	return new Promise(
		(resolve, reject) => {
		var	request = new XMLHttpRequest();

			request.addEventListener(
				'error'
			,	(evt) => getErrorFromEvent(evt, 'Request failed.', reject)
			);

			request.addEventListener(
				'load'
			,	(evt) => {
				var	response = evt.target.response;

					if (response) {
						resolve(response);
					} else {
						getErrorFromEvent(evt, 'Request completed, got empty or no response.', reject);
					}
				}
			);

			request.responseType = responseType || 'arraybuffer';
			request.open('GET', url, true);
			request.send();
		}
	);
}

function getImagePromiseFromCanvasToBlob(canvas, trackList, mimeType, quality) {
	return new Promise(
		(resolve, reject) => {
			canvas.toBlob(
				(blob) => {
					if (!blob) {
						reject(new Error('Canvas to blob: got empty or no blob.'));
						return;
					}

				var	url = URL.createObjectURL(blob);

					if (!url) {
						reject(new Error('Canvas to blob: got empty or no URL.'));
						return;
					}

					trackList = addURLToTrackList(url, trackList);

				var	img = cre('img');

					img.onload = (evt) => {
						// URL.revokeObjectURL(url);	//* <- let the outside code clean up after it's done

						resolve(img);
					};

					img.onerror = (evt) => {
						if (img.complete) {
							resolve(img);
							return;
						}

						if (TESTING) console.log(['img.onerror:', url, img, evt]);

						if (!trackList) {
							URL.revokeObjectURL(url);
						}

						getErrorFromEvent(evt, 'Canvas to blob: image loading failed.', reject);
					};

					img.src = url;
				}
			,	mimeType || ''
			,	quality || 1
			);
		}
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
var	count = 0;

	if (isNonNullObject(trackList)) {

		if (isFunction(trackList.push)) {
			for (let blob of trackList) if (blob) {
				URL.revokeObjectURL(blob.url || blob);

				++count;
			}
		} else
		if (isNonNullObject(trackList = trackList.blobs)) {

			if (isFunction(trackList.push)) {
				count += revokeBlobsFromTrackList(trackList);
			} else {
				for (let listName in trackList) {
					count += revokeBlobsFromTrackList(trackList[listName]);
				}
			}
		}
	}

	return count;
}

//* legacy copypasted code to get things working, don't bother with readability, redo later:

function dataToBlob(data, trackList) {
	if (URL && URL.createObjectURL) {
	var	type = TYPE_TEXT;
		if (hasPrefix(data, DATA_PREFIX)) {
		var	i = data.indexOf(',')
		,	meta = data.slice(k,i)
		,	data = data.slice(i+1)
		,	k = meta.indexOf(';')
			;

			if (k < 0) {
				type = meta;
				data = decodeURIComponent(data);
			} else {
				type = meta.slice(0,k);
				if (meta.slice(k+1) == 'base64') data = atob(data);
			}
		}
	var	data = Uint8Array.from(Array.prototype.map.call(data, ((v) => v.charCodeAt(0))))
	,	size = data.length
	,	url = URL.createObjectURL(new Blob([data], {'type': type}))
		;

		if (url) {
			addURLToTrackList(url, trackList);

			return {
				size: size
			,	type: type
			,	url: url
			};
		}
	}
}

function saveDL(data, fileName, ext, addTime, jsonReplacerFunc) {

	function cleanUpAfterDL() {
		if (a) del(a);
		if (blob) URL.revokeObjectURL(blob.url);
	}

var	type = TYPE_TEXT
,	data = (
		isNonNullObject(data)
		? JSON.stringify(
			data
		,	jsonReplacerFunc || null
		,	'\t'
		)
		: String(data)
	);

	if (hasPrefix(data, BLOB_PREFIX)) {
	var	dataURI = data
	,	blob = true
		;
	} else
	if (hasPrefix(data, DATA_PREFIX)) {
		dataURI = data;
	} else {
		dataURI = DATA_PREFIX + type + ',' + encodeURIComponent(data);
	}

var	size = dataURI.length
,	a = cre('a', document.body)
	;

	logTime('saving "' + fileName + '", data = ' + data.length + ' bytes, dataURI = ' + size + ' bytes' + (blob ? ', URI = ' + dataURI : ''));

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
			if (ext == 'plain') ext = 'txt';

		var	time = (
				!fileName || addTime
				? getFormattedTime({fileNameFormat: true})
				: ''
			)
		,	baseName = (
				function() {
					if (!fileName) return time;
					if (addTime > 0) return fileName + '_' + time;
					if (addTime < 0) return time + '_' + fileName;
					return fileName;
				}
			)()
		,	fileName = baseName + (ext ? '.' + ext : '')
			;

			a.onclick = cleanUpAfterDL;	//* <- https://stackoverflow.com/a/26643754
			a.download = fileName;
			a.href = String(dataURI);
			a.click();

			logTime('saving "' + fileName + '"');
		} catch (error) {
			logError(arguments, error);
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

function loadLibPromise(lib) {
	return new Promise(
		(resolve, reject) => {

			function addNextScript() {
				if (scripts.length > 0) {
				var	script = cre('script', document.head);
					script.onload = addNextScript;
					script.onerror = (evt) => getErrorFromEvent(evt, 'Script loading failed.', reject);
					script.src = dir + scripts.shift();
				} else {
					resolve(true);
				}
			}

		var	dir = lib.dir || ''
		,	scripts = lib.files || getFlatArray(
				isArray(lib)
				? lib
				: Array.from(arguments)
			);

			addNextScript();
		}
	);
}

async function loadLibOnDemandPromise(libName) {
	if (!libName) {
		return false;
	}

var	lib = fileTypeLibs[libName] || {};
	if (!lib) {
		return false;
	}

var	varName = lib.varName || '';
	if (varName && window[varName]) {
		return true;
	}

var	dir = lib.dir || ''
,	scripts = Array.from(lib.files || [])
	;

	if (!scripts.length) {
		return false;
	}

var	depends = lib.depends || null;
	if (depends) {
		for (let name of Array.from(depends)) if (name) {
			if (!(await loadLibOnDemandPromise(name))) {
				return false;
			}
		}
	}

	return new Promise(
		(resolve, reject) => {

			function addNextScript(evt) {

//* some var init, no better place for this:

				if (varName === 'zip' && window[varName]) {
					if (zip.useWebWorkers = !RUNNING_FROM_DISK) {

//* Note: either zip.workerScripts or zip.workerScriptsPath may be set, not both.
//* source: http://gildas-lormeau.github.io/zip.js/core-api.html#alternative-codecs

						if (USE_ZLIB_ASM) {
						var	zipWorkerScripts = [
								dir + zlibAsmSubDir + 'zlib.js',
								dir + 'zlib-asm/codecs.js',
								dir + 'z-worker.js',
							];

							zip.workerScripts = {
								deflater: zipWorkerScripts,
								inflater: zipWorkerScripts,
							};
						} else {
							zip.workerScriptsPath = dir;
						}
					}
				}

				if (varName === 'ora' && window[varName]) {
					ora.enableImageAsBlob = true;
					ora.enableWorkers = !RUNNING_FROM_DISK;
					ora.scriptsPath = dir;
				}

				if (varName === 'PSD_JS' && !window[varName] && evt) {
					window[varName] = require('psd');
				}

//* add scripts one by one:

				if (scripts.length > 0) {
				var	script = cre('script', document.head);
					script.setAttribute('data-lib-name', libName);
					script.onload = addNextScript;
					script.onerror = (evt) => getErrorFromEvent(evt, 'Script loading failed.', reject);
					script.src = dir + scripts.shift();
				} else

//* then check whether the required object is present:

				if (window[varName]) {
					logTime('"' + libName + '" library finished loading');

					resolve(true);
				} else {

//* otherwise, cleanup and report fail:

					del(
						gt('script', document.head)
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
	);
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
		var	targetRefZoom = orz(value);

			if (targetRefZoom <= 0 || targetRefZoom === 100) {
				return;
			}

//* zoom in steps, downscale by no more than x2, starting from 100 to nearest-sized reference:

		var	nearestRefZoom = 100;

			while (
				nearestRefZoom > 0
			&&	nearestRefZoom > targetRefZoom
			) {
			var	nextStepZoom = Math.floor(nearestRefZoom / ZOOM_STEP_MAX_FACTOR);

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
	var	canvas = cre('canvas')
	,	ctx = canvas.getContext('2d')
	,	w = canvas.width  = THUMBNAIL_SIZE
	,	h = canvas.height = THUMBNAIL_SIZE
	,	textHeight = THUMBNAIL_SIZE - 2
		;

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

	var	text = '?'
	,	textWidth = ctx.measureText(text).width
	,	x = Math.round((w - textWidth) / 2)
	,	y = Math.round((h - textHeight) / 2)
		;

		ctx.fillText(text, x,y);

		thumbnailPlaceholder = canvas.toDataURL();
	}

	return thumbnailPlaceholder;
}

function setImageSrc(img, data) {
	if (isImageElement(img)) {
		if (data || !img.src) {
			img.src = data || getImageSrcPlaceholder();
		}
	} else
	if (img.style) {
		if (data || !img.style.backgroundImage) {
			data = data || getImageSrcPlaceholder();
			img.style.backgroundImage = 'url("' + data + '")';
		}
	}

	return img;
}

function getResizedCanvasFromImg(img, w,h) {
var	canvas = cre('canvas')
,	ctx = canvas.getContext('2d')
,	widthFrom  = img.width
,	heightFrom = img.height
,	widthTo  = w || widthFrom || 1
,	heightTo = h || w || heightFrom || 1
,	widthRatio  = widthFrom/widthTo
,	heightRatio = heightFrom/heightTo
	;

	if (
		widthRatio  > THUMBNAIL_ZOOM_STEP_MAX_FACTOR
	||	heightRatio > THUMBNAIL_ZOOM_STEP_MAX_FACTOR
	) {

//* caclulate nearest scale factor top down:

		if (DOWNSCALE_BY_MAX_FACTOR_FIRST) {
			canvas.width  = widthTo  = Math.round(widthFrom  / THUMBNAIL_ZOOM_STEP_MAX_FACTOR);
			canvas.height = heightTo = Math.round(heightFrom / THUMBNAIL_ZOOM_STEP_MAX_FACTOR);
		} else {

//* caclulate nearest scale factor bottom up - more complex, but result is not better:

			if (widthRatio < heightRatio) {
				widthTo = Math.round(widthFrom / heightRatio);
			} else
			if (widthRatio > heightRatio) {
				heightTo = Math.round(heightFrom / widthRatio);
			}

		var	widthToUp  = widthTo
		,	heightToUp = heightTo
			;

			while (
				widthTo  < widthFrom
			&&	heightTo < heightFrom
			) {
				widthToUp  *= THUMBNAIL_ZOOM_STEP_MAX_FACTOR;
				heightToUp *= THUMBNAIL_ZOOM_STEP_MAX_FACTOR;

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
	var	xOffset = 0
	,	yOffset = 0
		;

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

function getCanvasFromByteArray(rgbaArray, w,h) {
var	canvas = cre('canvas')
,	ctx = canvas.getContext('2d')
	;

	canvas.width = w;
	canvas.height = h;

var	imageData = ctx.createImageData(w,h);
	imageData.data.set(rgbaArray);

	ctx.putImageData(imageData, 0,0);

	return canvas;
}

function getImageData(img, x,y, w,h) {
	if (isCanvasElement(img)) {
	var	canvas = img
	,	ctx = canvas.getContext('2d')
		;

		x = orz(x);
		y = orz(y);
		w = orz(w) || (canvas.width  - x);
		h = orz(h) || (canvas.height - y);
	} else
	if (isImageElement(img)) {
	var	canvas = cre('canvas')
	,	ctx = canvas.getContext('2d')
		;

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
var	canvas = cre('canvas')
,	ctx = canvas.getContext('2d')
	;

	canvas.width = imageData.width;
	canvas.height = imageData.height;

	ctx.putImageData(imageData, 0,0);

	return ctx;
}

function getImageDataInverted(imageData) {
var	ctx = getCtxFromImageData(imageData)
,	w = imageData.width
,	h = imageData.height
	;

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
	if (!(img = getImageData(img))) {
		return;
	}

var	data = img.data
,	totalBytes = data.length
,	w = img.width
,	h = img.height
,	horizontalBytes = w << 2
,	bgRGBA, bgPixelIndex, index, x
,	foundTop, foundLeft, foundBottom, foundRight
	;

	if (
		bgToCheck
	&&	bgToCheck.length
	&&	bgToCheck !== 'transparent'
	) {
		if (bgToCheck === 'topleft') bgPixelIndex = 0; else
		if (bgToCheck === 'topright') bgPixelIndex = w - 1; else
		if (bgToCheck === 'bottomleft') bgPixelIndex = w*(h - 1); else
		if (bgToCheck === 'bottomright') bgPixelIndex = (w*h) - 1;

		if (typeof bgPixelIndex !== 'undefined') {
		var	bgByteIndex = bgPixelIndex << 2;
			bgRGBA = data.slice(bgByteIndex, bgByteIndex + 4);
		} else {
			if (bgToCheck.match) {
				bgToCheck = getRGBAFromColorCodeOrName(bgToCheck);
			}

			if (bgToCheck.concat) {
				index = bgToCheck.length;
				bgRGBA = (
					index >= 4
					? bgToCheck.slice(0,4)
					: bgToCheck.concat([0,0,0,255].slice(index))
				);
			}
		}
	}

	bgRGBA = (bgRGBA ? Array.from(bgRGBA) : [0,0,0,0]);

//* find fully transparent areas:

	if (bgRGBA[3] === 0) {

		find_top:
		for (index = 3; index < totalBytes; index += 4) {
			if (data[index]) {
				foundTop = Math.floor(index / horizontalBytes);
				break find_top;
			}
		}

	//* found no content:

		if (typeof foundTop === 'undefined') {
			return;
		}

	//* found something:

		find_bottom:
		for (index = totalBytes - 1; index >= 0; index -= 4) {
			if (data[index]) {
				foundBottom = Math.floor(index / horizontalBytes);
				break find_bottom;
			}
		}

	//* reduce field of search:

	var	foundTopIndex = (foundTop * horizontalBytes) + 3
	,	foundBottomIndex = (foundBottom * horizontalBytes) + 3
		;

		find_left:
		for (x = 0; x < w; ++x)
		for (index = (x << 2) + foundTopIndex; index <= foundBottomIndex; index += horizontalBytes) {
			if (data[index]) {
				foundLeft = x;
				break find_left;
			}
		}

		find_right:
		for (x = w-1; x >= 0; --x)
		for (index = (x << 2) + foundTopIndex; index <= foundBottomIndex; index += horizontalBytes) {
			if (data[index]) {
				foundRight = x;
				break find_right;
			}
		}
	} else {

//* find same RGBA filled areas:

		index = totalBytes;

		find_bottom:
		while (index--) {
			if (data[index] !== bgRGBA[index & 3]) {
				foundBottom = Math.floor(index / horizontalBytes);
				break find_bottom;
			}
		}

	//* found no content:

		if (typeof foundBottom === 'undefined') {
			return;
		}

	//* found something:

		find_top:
		for (index = 0; index < totalBytes; index++) {
			if (data[index] !== bgRGBA[index & 3]) {
				foundTop = Math.floor(index / horizontalBytes);
				break find_top;
			}
		}

	//* reduce field of search:

	var	foundTopIndex = (foundTop * horizontalBytes)
	,	foundBottomIndex = (foundBottom * horizontalBytes)
		;

		find_left:
		for (x = 0; x < w; ++x)
		for (index = (x << 2) + foundTopIndex; index <= foundBottomIndex; index += horizontalBytes) {
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
		for (x = w-1; x >= 0; --x)
		for (index = (x << 2) + foundTopIndex; index <= foundBottomIndex; index += horizontalBytes) {
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

var	foundWidth = foundRight - foundLeft + 1
,	foundHeight = foundBottom - foundTop + 1
	;

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
var	button = cre('button', parent);

	button.textContent = text || button.tagName;
	if (func) button.setAttribute('onclick', func);

	return button;
}

function addOption(parent, text, value) {
var	option = cre('option', parent)
,	text = getJoinedOrEmptyText(text)
,	value = getJoinedOrEmptyText(value) || text
	;

	option.value = value;
	option.textContent = text;

	return option;
}

function trimParam(text) {
	return (
		String(text)
		.replace(regLayerNameParamTrim, '')
	);
}

function getOtherSwitchParamName(switchType, switchName) {
var	names = SWITCH_NAMES_BY_TYPE[switchType]
,	index = names.indexOf(switchName)
	;

	return names[
		index < 0
		? 0
		: 1 - index
	];
}

function getTruthyValue(value) {
	return !(
		!value
	||	!(value = String(value))
	||	FALSY_STRINGS.indexOf(value.toLowerCase()) >= 0
	);
}

function getNormalizedOpacity(numValue) {
	return Math.max(0, Math.min(1, orz(numValue) / MAX_OPACITY));
}

function getNormalizedBlendMode(text) {
var	blendMode = String(text).toLowerCase()
,	replaced
	;

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

var	path = (flags.includeSelf ? [layer.name] : []);

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
var	layers = [];

	while (layer) {
		layers.push(layer);

		layer = layer.clippingLayer || getParentLayer(layer);
	}

	return layers.reverse();
}

function getLayersTopSeparated(layers) {
var	layersToRender = [];

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
		console.log(['No params:', layer, getLayerPathText(layer)]);
	}

	return !!(
		layer.params.skip
	||	(regLayerNameToSkip && regLayerNameToSkip.test(layer.name))
	||	(layer.clippingLayer && isLayerSkipped(layer.clippingLayer))
	);
}

async function getImageDataFromURL(url) {
var	arrayBuffer = await getFilePromiseFromURL(url)
,	img  = UPNG.decode(arrayBuffer)
,	rgba = UPNG.toRGBA8(img)[0]	//* <- UPNG.toRGBA8 returns array of frames, size = width * height * 4 bytes.
	;

	return {
		width: img.width
	,	height: img.height
	,	data: rgba
	};
}

//* pile of hacks and glue to get things working, don't bother with readability, redo later:

function thisToPng(targetLayer) {
	try {
	var	t = targetLayer || this
	,	e = t.sourceData || t
	,	i = e.prerendered || e.thumbnail
		;

		if (i) {
			return i;
		}

		if (isImageElement(e = e.image || e)) {
			return e;
		}

		if (
			e.toPng
		&&	(
				e.toPng != thisToPng
			||	t != e
			)	//* <- to avoid infinite recursion
		&&	(i = e.toPng())
		) {
			return i;
		}
	} catch (error) {
		if (i = targetLayer) {
			logTime('cannot get layer image: ' + getLayerPathText(i));
		} else {
			logError(arguments, error);
		}
	}

	return null;
}

//* Page-specific functions: internal, loading *-------------------------------

function isStopRequestedAnywhere() {
	return (
		isStopRequested
	||	Array.from(arguments).some(
			(obj) => (
				isNonNullObject(obj)
			&&	obj.isStopRequested
			)
		)
	);
}

async function removeProjectView(fileId) {
var	countDeleted = gi(fileId).reduce(
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

async function addProjectView(sourceFile) {

	if (
		!sourceFile
	||	!window.FileReader
	) {
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

var	buttonTab = cre('div', id('loaded-files-selection'));
	buttonTab.className = 'button loading';

var	buttonThumb = cre('button', buttonTab);
	buttonThumb.className = 'thumbnail-button';

var	thumbImg = cre('img', buttonThumb);
	thumbImg.className = 'thumbnail';

var	buttonText = cre('button', buttonTab);
	buttonText.textContent = sourceFile.name;

var	buttonClose = cre('button', buttonTab);
	buttonClose.className = 'close-button';
	buttonClose.textContent = 'X';

	buttonClose.setAttribute('onclick', 'closeProject(this)');

	setImageSrc(thumbImg);

	try {
	var	project = await getNormalizedProjectData(sourceFile, buttonTab);

		if (project) {
			buttonTab.project = project;

			if (isStopRequestedAnywhere(project, buttonTab)) {
				project.isStopRequested = true;
			} else {
				project.thumbnail = thumbImg;

			var	container = (
					await getProjectViewMenu(project)
				||	await getProjectViewImage(project)
				);
			}

			if (isStopRequestedAnywhere(project, buttonTab)) {
				container = null;
			}
		}

		if (container) {
		var	fileId = 'loaded-file: ' + sourceFile.name
		,	childKeys = ['layers']
			;

			cleanupObjectTree(project, childKeys, TESTING ? CLEANUP_KEYS_TESTING : CLEANUP_KEYS);

			container.className = 'loaded-file';

			project.container = container;
			container.project = project;

		var	result = !isStopRequestedAnywhere(project, buttonTab);

			if (result) {
				if (project.options) {
					updateBatchCount(project);

					if (result = await updateMenuAndShowImg(project)) {
						buttonTab.className = 'button loaded with-options';
					}
				} else {
					buttonTab.className = 'button loaded without-options';
				}
			}

//* attach prepared DOM branch to visible document:

			if (result) {
				if (OPEN_FIRST_MENU_TAB_AT_START) {
					closeAllDropdownMenuTabs(gc('menu-bar')[0]);
				}

				removeProjectView(fileId);

				container.id = buttonTab.id = fileId;
				id('loaded-files-view').appendChild(container);

				buttonText.setAttribute('onclick', 'selectProject(this)');
				buttonThumb.setAttribute('onclick', 'selectProject(this)');

				buttonText.click();

				return true;
			}
		}

//* cleanup on errors or cancel:

	} catch (error) {
		logError(arguments, error);
	}

	buttonTab.className = 'button loading failed';

	setTimeout(function() {
		del(buttonTab);
	}, 2000);

	return false;
}

async function getNormalizedProjectData(sourceFile, button) {

	async function tryFileParserFunc(func, project) {
		try {
			return await func(project);
		} catch (error) {
			logError(arguments, error);
		}

		return null;
	}

	if (!sourceFile) {
		return null;
	}

var	fileName = sourceFile.name
,	baseName = sourceFile.baseName
,	ext      = sourceFile.ext
,	actionLabel = 'processing document structure';
	;

	logTime('"' + fileName + '" started ' + actionLabel);

var	startTime = getTimeNow();

	try_loaders:
	for (let loader of fileTypeLoaders) if (loader.dropFileExts.indexOf(ext) >= 0)
	for (let func of loader.handlerFuncs) {
	var	project = {
			fileName: fileName
		,	baseName: baseName
		,	loading: {
				startTime: getTimeNow()
			,	data: sourceFile
			,	images: []
			}
		};

		if (await tryFileParserFunc(func, project)) {
			break try_loaders;
		} else {
			project = null;
		}

		if (isStopRequestedAnywhere(project, button)) {
			 break;
		}
	}

var	tookTime = getTimeNow() - startTime;

	logTime(
		'"' + fileName + '"'
	+	(
			project
			? ' finished ' + actionLabel + ', took '
			: (
				isStopRequestedAnywhere(project, button)
				? ' stopped by request '
				: ' failed '
			) + actionLabel + ' after '
		)
	+	tookTime
	+	' ms total'
	);

	if (isStopRequestedAnywhere(project, button)) {
		return null;
	}

	return project;
}

async function getProjectViewMenu(project) {

	async function getProjectOptionsContainer(project) {

//* render default set when everything is ready:

		try {
		var	options = getProjectOptions(project)
		,	fileName = project.fileName
			;

			if (options) {
			var	images = project.loading.images
			,	imagesCount = project.loading.imagesCount = images.length
			,	actionLabel = 'preloading ' + imagesCount + ' images'
			,	result, layer
				;

				logTime('"' + fileName + '" started ' + actionLabel);

//* try loading one by one to avoid flood of errors:

			var	startTime = getTimeNow();

				while (
					images.length > 0
				&&	(layer = images.pop())
				&&	(result = !isStopRequestedAnywhere(project))
				&&	(result = await getLayerImgLoadPromise(layer, project))
				&&	(result = await getLayerMaskLoadPromise(layer, project))
				);

			var	tookTime = getTimeNow() - startTime;

				logTime(
					'"' + fileName + '"'
				+	(
						result
						? ' finished ' + actionLabel + ', took '
						: (
							isStopRequestedAnywhere(project)
							? ' stopped by request '
							: ' failed '
						) + actionLabel + ' after '
					)
				+	tookTime
				+	' ms'
				);

				if (isStopRequestedAnywhere(project)) {
					return;
				}

				if (result) {
					project.options = options;
					project.layersTopSeparated = getLayersTopSeparated(project.layers);

				var	container = createProjectView(project);
					createOptionsMenu(project, gc('project-options', container)[0]);

					return container;
				}
			} else {
				logTime('"' + fileName + '" has no options.');
			}
		} catch (error) {
			logError(arguments, error);

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

			var	sectionName = String(sectionName)
			,	listName    = String(listName)
			,	sections    = getOrInitChild(options, sectionName)
			,	optionGroup = getOrInitChild(sections, listName, 'params', 'items')
				;

				return optionGroup;
			}

			function checkSwitchParams(globalOptionParams) {
				for (let switchType in SWITCH_NAMES_BY_TYPE)
				for (let switchName of SWITCH_NAMES_BY_TYPE[switchType]) if (params[switchName]) {
				var	switchParam = getOrInitChild(project, 'switchParamNames')
				,	switchParam = getOrInitChild(switchParam, switchType)
					;

					if (!switchParam.implicit) {
						switchParam.implicit = getOtherSwitchParamName(switchType, switchName);
						switchParam.explicit = switchName;
					}

					globalOptionParams[switchName] = true;
				}
			}

			function checkMinMaxParams(params, optionParams, paramName) {
			var	paramMS = params[paramName];

				if (isNonNullObject(paramMS)) {
				var	optionMS = optionParams[paramName];

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
			var	optionGroup = getOptionGroup(sectionName, listName)
			,	optionParams = optionGroup.params
				;

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

			var	optionGroup = getOptionGroup(sectionName, listName)
			,	optionParams = optionGroup.params
			,	optionItems = optionGroup.items
			,	optionItemLayers = getOrInitChild(optionItems, optionName, Array)
				;

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
						var	optionName = String(optionValue);

							if (isNaN(optionValue)) {
								optionName = optionName.replace(regNonAlphaNum, '').toLowerCase();

								if (PARAM_KEYWORDS_SHORTCUT_FOR_ALL.indexOf(optionName) >= 0) {
									keywordsList.forEach(
										(optionName) => {
											optionItems[optionName] = optionName;
										}
									);
								} else
								if (keywordsList.indexOf(optionName) >= 0) {
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

			var	param = params[sectionName];

				if (!param) {
					return;
				}

				if (!listName && sectionName === 'collage') {
					for (let listName in param) {
						addOptionsFromParam(sectionName, listName);
					}
					return;
				}

			var	optionGroup = addOptionGroup(sectionName, listName || sectionName)
			,	optionParams = optionGroup.params
			,	optionItems = optionGroup.items
				;

				checkSwitchParams(optionParams);

				if (sectionName === 'separate') {
					optionItems[sectionName] = sectionName;
				} else
				if (sectionName === 'side') {
					for (let optionName of VIEW_SIDES) {
						optionItems[optionName] = getLocalizedText(sectionName + '_' + optionName);
					}

				var	index = VIEW_SIDES.indexOf(param);

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
					if (param = params['radius']) {
						param.forEach(
							(padding) => {
								if (isString(padding)) {
									padding = JSON.parse(padding);
								}

							var	{method, threshold, dimensions} = padding
							,	isBox = ('x' in dimensions)
							,	[openBracket, closeBracket] = (isBox ? '[]' : '()')
							,	optionNameParts = [
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
								]
							,	optionName = (
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
							var	optionName = String(optionValue);
								optionItems[optionName] = optionValue;
							}
						);
					}
				} else
				if (sectionName === 'zoom' || sectionName === 'opacities') {
				var	format = param.format;

					if (format) {
						optionParams.format = format;
					}

				var	values = param.values;

					if (values) {
						values.forEach(
							(optionValue) => {

//* pad bare numbers to avoid numeric autosorting in <select>:

							var	optionName = optionValue + '%';

								if (sectionName === 'opacities') {
									optionValue = (orz(optionValue) / 100);
								}

								optionItems[optionName] = optionValue;
							}
						);
					}
				}
			}

		var	params = layer.params
		,	name = layer.name
		,	names = layer.names = (
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

		var	layersInside = layer.layers
		,	layerCopyParams = params.copypaste
			;

			if (layerCopyParams) {
			var	aliasTypes = getOrInitChild(project, 'layersForCopyPaste');

				for (let paramType in layerCopyParams) {
				var	aliases = getOrInitChild(aliasTypes, paramType);

					layerCopyParams[paramType].forEach(
						(alias) => {
						var	layersByAlias = getOrInitChild(aliases, alias, Array);

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
			var	parent = getParentLayer(layer);

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
				layer.opacity > 0
			&&	(
					params.color_code
				||	(
						layer.mask
					&&	layer.mask.maskData
					)
				||	(
						!layersInside
					&&	layer.width > 0
					&&	layer.height > 0
					)
				)
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
		var	index = layers.length
		,	clippingLayer = null
		,	layer
			;

			while (index--) if (layer = layers[index]) {
				if (layer.isClipped) {
					layer.clippingLayer = clippingLayer;
				} else {
					clippingLayer = (layer.isPassThrough ? null : layer);
				}
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

	var	options;

		project.layers = getUnskippedProcessedLayers(project.layers);

		for (let sectionName in PARAM_OPTIONS_ADD_BY_DEFAULT) if (!options[sectionName]) {
			getProcessedLayerInBranch(
				getLayerWithParamsFromParamList(
					PARAM_OPTIONS_ADD_BY_DEFAULT[sectionName]
				)
			);
		}

		for (let switchType in SWITCH_NAMES_BY_TYPE) {
		var	switchParam = getOrInitChild(project, 'switchParamNames')
		,	switchParam = getOrInitChild(switchParam, switchType)
			;

			if (!switchParam.implicit) {
			var	switchName = SWITCH_NAMES_DEFAULT[switchType];

				switchParam.implicit = switchName;
				switchParam.explicit = getOtherSwitchParamName(switchType, switchName);
			}
		}

		return options;
	}

	function getLayerImgLoadPromise(layer, project) {
		return new Promise(
			(resolve, reject) => {
				if (layer.layers) {
					if (TESTING) console.log(
						'No image loaded because it is folder at: '
					+	getLayerPathText(layer)
					);

					resolve(true);
					return;
				}

			var	colorCode = getPropByNameChain(layer, 'params', 'color_code');

				if (
					colorCode
				&&	!VERIFY_PARAM_COLOR_VS_LAYER_CONTENT
				) {
					// if (TESTING) console.log(
						// 'got color code in param: '
					// +	getColorTextFromArray(colorCode)
					// +	', layer content not checked at: '
					// +	getLayerPathText(layer)
					// );

					layer.img = colorCode;

					resolve(true);
					return;
				}

			var	img = null;

				try {
					img = project.toPng(layer);
				} catch (error) {
					logError(arguments, error);
				}

				if (
					img
				&&	isImageElement(img)
				) {
					img.onload = (evt) => {
						if (layer.isColor) {
							layer.img = getFirstPixelRGBA(img);

							if (colorCode) {
							var	colorCodeText = getColorTextFromArray(colorCode)
							,	layerRGBAText = getColorTextFromArray(layer.img)
								;

								if (layerRGBAText != colorCodeText) {
									console.log(
										'got color code in param: '
									+	colorCodeText
									+	', prefered instead of layer content: '
									+	layerRGBAText
									+	', at:'
									+	getLayerPathText(layer)
									);
								}

								layer.img = colorCode;
							}
						} else {
							img.top  = layer.top;
							img.left = layer.left;

							layer.img = img;
						}

						resolve(true);
					};

					img.onerror = (evt) => {
						if (img.complete) {
							resolve(true);
							return;
						}

						if (TESTING) console.log(['img.onerror:', img, evt]);

						resolve(false);
					}

					if (img.complete) {
						img.onload();
					}
				} else
				if (colorCode) {
					if (TESTING) console.log(
						'got color code in param: '
					+	getColorTextFromArray(colorCode)
					+	', layer content not found at: '
					+	getLayerPathText(layer)
					);

					layer.img = colorCode;

					resolve(true);
				} else {
					resolve(false);
				}
			}
		);
	}

	function getLayerMaskLoadPromise(layer, project) {
		return new Promise(
			(resolve, reject) => {
				if (
					(mask = layer.mask)
				&&	(maskData = mask.maskData)
				) {
				var	mask, maskData
				,	w = mask.width
				,	h = mask.height
				,	canvas = getCanvasFromByteArray(maskData, w,h)
					;

					getImagePromiseFromCanvasToBlob(canvas, project).then(
						(img) => {
							if (img) {
								layer.mask.img = img;

								resolve(true);
							} else {
								resolve(false);
							}
						}
					).catch(
						(error) => {
							console.log(error);

							resolve(false);
						}
					);
				} else {
					resolve(true);
				}
			}
		);
	}

	function createOptionsMenu(project, container) {

		function addOptions(sectionName, entry) {

			function addOptionColor(rgba) {
				if (rgba) {
				var	colorStyle = getColorTextFromArray(rgba, 3);

					if (colorStyle) {
						addToListIfNotYet(colorStyles, colorStyle);
					}
				}
			}

			function getOptionLabelFromColor(colorCode, prefix) {
			var	rgba = getRGBAFromColorCodeOrName(colorCode)
			,	text = String(colorCode)
				;

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

		var	section = options[sectionName]
		,	isEntryList = (entry && !isString(entry))
		,	optionLists = (isEntryList ? entry : section)
		,	optionList
			;

//* list box = set of parts:

			for (let listName in optionLists) if (optionList = section[listName]) {
			var	listLabel = getLocalizedText((isEntryList ? optionLists[listName] : entry) || listName)
			,	items = optionList.items
			,	params = optionList.params
			,	isZeroSameAsEmpty = (
					ZERO_PERCENT_EQUALS_EMPTY
				&&	NAME_PARTS_PERCENTAGES.indexOf(sectionName) >= 0
				)
			,	addEmpty = !(
					sectionName === 'side'
				||	'' in items
				) && (
					params.multi_select
				&&	params.multi_select.min <= 0
				);

			var	tr = cre('tr', table);
				tr.className = 'project-option';

			var	td = cre('td', tr);
				td.title = listLabel;
				td.textContent = listLabel + ':';

			var	selectBox = cre('select', cre('td', tr));
				selectBox.name = listName;
				selectBox.setAttribute('data-section', sectionName);

				if (sectionName !== 'collage')
				for (let switchType in SWITCH_NAMES_BY_TYPE) {
				var	implicitName = getPropByNameChain(project, 'switchParamNames', switchType, 'implicit')
				,	explicitName = getPropByNameChain(project, 'switchParamNames', switchType, 'explicit')
				,	isImplied = (typeof params[explicitName] === 'undefined')
					;

					params[implicitName] = isImplied;
					params[explicitName] = !isImplied;

				var	switchNames = SWITCH_CLASS_BY_TYPE[switchType]
				,	td = cre('td', tr)
				,	label = cre('label', td)
				,	checkBox = cre('input', label)
					;

					checkBox.type = 'checkbox';
					checkBox.className = switchType + '-checkbox';
					checkBox.setAttribute('data-switch-type', switchType);
					checkBox.checked = checkBox.initialValue = !params[SWITCH_NAMES_BY_TYPE[switchType][0]];
					checkBox.params = params;

					for (let index in switchNames) {
					var	switchName = switchNames[index]
					,	button = cre('div', label)
						;

						button.className = switchType + '-' + switchName + ' ' + SWITCH_CLASS_BY_INDEX[index];
						button.title = (
							getLocalizedText('switch_' + switchName)
						+	': \r\n'
						+	getLocalizedText('hint_switch_' + switchName)
						);
					}
				}

//* list item = each part:

				for (let optionName in items) {
					if (
						optionName === ''
					||	(
							isZeroSameAsEmpty
						&&	orz(optionName) == 0
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
					var	zoomPercentage = orz(optionName);

						if (
							zoomPercentage == 100
						||	zoomPercentage <= 0
						) {
							if (addedDefaultZoom) {
								continue;
							}

						var	addedDefaultZoom = true;
							addEmpty = false;

							addOption(selectBox, '100%');

							continue;
						}

						addOption(selectBox, optionName);
					} else {
					var	optionLabel = optionName
					,	optionValue = optionName
					,	colorStyles = []
						;

						function setLocalizedColorOptionLabel(key, colorListNames) {

						var	localizedLabel = getLocalizedOrEmptyText(key);

							if (localizedLabel) {
								optionLabel = localizedLabel;

								return true;
							}

							if (
								!colorListNames
							||	colorListNames.indexOf(listName) >= 0
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

					var	optionItem = addOption(selectBox, optionLabel, optionValue);

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

			var	preselectByValue = getPropByNameChain(project, 'options', sectionName, listName, 'params', 'preselect');

				selectBox.initialValue = (
					preselectByValue
					? selectValue(selectBox, preselectByValue)
					: selectValueByPos(selectBox, params.last ? 'bottom' : 'top')
				);

			var	tabCount = gt('td', tr).length;
				if (maxTabCount < tabCount) maxTabCount = tabCount;
			}
		}

		function addHeader(text) {
		var	th = cre('header', cre('th', cre('tr', table)));
			th.textContent = getLocalizedText(text) + ':';
		}

	var	options = project.options
	,	table = cre('table', container)
	,	maxTabCount = 0
		;

		for (let sections of PROJECT_OPTION_GROUPS) {
			if (sections.header) {
			var	header = sections.header;

				sections = sections.select;

				for (let sectionName in sections) {
					if (options[sectionName]) {
						if (header) {
							addHeader(header);
							header = null;
						}
						addOptions(sectionName, sections[sectionName]);
					}
				}
			} else {
				for (let sectionName in sections) {
					if (options[sectionName]) {
						addHeader(sections[sectionName]);
						addOptions(sectionName);
					}
				}
			}
		}

		gt('th', table).forEach(
			(th) => {
				th.colSpan = maxTabCount;
			}
		);
	}

	return await getProjectOptionsContainer(project);
}

function createProjectView(project) {
var	container = cre('div')
,	header = cre('header', container)
	;

	header.className = 'project-header';

//* show overall project info:

var	summary       = cre('section', header)
,	summaryHeader = cre('header', summary)
,	summaryBody   = cre('div',    summary)
,	summaryFooter = cre('footer', summary)
	;

	summaryHeader.className = 'filename';
	summaryHeader.textContent = project.fileName;

var	bitDepthText = '';

	if (project.channels && project.bitDepth) {
		bitDepthText = project.channels + 'x' + project.bitDepth + ' ' + getLocalizedText('project_bits');
	} else
	if (project.channels) {
		bitDepthText = project.channels + ' ' + getLocalizedText('project_channels');
	} else
	if (project.bitDepth) {
		bitDepthText = project.bitDepth + ' ' + getLocalizedText('project_bits');
	}

var	canvasSizeText = (
		project.width + 'x'
	+	project.height + ' '
	+	getLocalizedText('project_pixels')
	)
,	colorModeText  = getNestedFilteredArrayJoinedText([project.colorMode, bitDepthText], ' ')
,	resolutionText = getNestedFilteredArrayJoinedText([canvasSizeText, colorModeText], ', ')
	;

var	foldersCount = project.foldersCount
,	layersCount  = project.layersCount
,	imagesCount  = project.loading.imagesCount
,	layersTextParts = []
	;

	if (foldersCount) layersTextParts.push(foldersCount + ' ' + getLocalizedText('project_folders'));
	if (layersCount)  layersTextParts.push(layersCount  + ' ' + getLocalizedText('project_layers'));
	if (imagesCount)  layersTextParts.push(imagesCount  + ' ' + getLocalizedText('project_images'));

var	layersText = getNestedFilteredArrayJoinedText(layersTextParts, ', ')
,	summaryTextParts = [resolutionText, layersText]
	;

var	sourceFile = project.loading.data.file || {}
,	sourceFileTime = sourceFile.lastModified || sourceFile.lastModifiedDate
	;

	if (sourceFile.size) summaryTextParts.push(sourceFile.size + ' ' + getLocalizedText('file_bytes'));
	if (sourceFileTime)  summaryTextParts.push(getLocalizedText('file_date') + ' ' + getFormattedTime(sourceFileTime));

	summaryBody.innerHTML = getNestedFilteredArrayJoinedText(summaryTextParts, '<br>');

var	infoButton = addButton(summaryFooter, getLocalizedText('console_log'));
	infoButton.name = 'console_log';

	container.addEventListener('click', onProjectButtonClick, false);

//* add batch controls:

	function addButtonGroup(container, group) {

		function addNamedButton(container, name, label) {
			addButton(container, getLocalizedText(label || name)).name = name || label;
		}

		for (let buttonName in group) {
		var	entry = group[buttonName];

			if (isString(entry)) {
				addNamedButton(container, buttonName, entry);
			} else
			if (isNonNullObject(entry)) {
				addButtonGroup(cre('div', container), entry);
			}
		}
	}

	if (project.options) {
		for (let controlGroup of PROJECT_CONTROLS) {
		var	buttons = controlGroup.buttons
		,	buttonsGroup = cre('section', header)
		,	buttonsHeader = cre('header', buttonsGroup)
		,	buttonsFooter = cre('footer', buttonsGroup)
			;

			buttonsHeader.textContent = getLocalizedText(controlGroup.header) + ':';

			addButtonGroup(buttonsFooter, buttons);
		}

		container.addEventListener('change', onProjectMenuUpdate, false);

//* place for results:

		tr = cre('tr', cre('table', container));
		cre('td', tr).className = 'project-options';
		cre('td', tr).className = 'project-render';
	}

	return container;
}

function setProjectThumbnail(project, fullImage) {
	if (
		fullImage
	&&	project
	&&	project.thumbnail
	) {
	var	canvas = getResizedCanvasFromImg(fullImage, THUMBNAIL_SIZE);
		if (canvas) {
			setImageSrc(project.thumbnail, canvas.toDataURL());
		}

		if (TAB_THUMBNAIL_ZOOM) {
		var	preview = project.thumbnail.nextElementSibling;
			if (!preview) {
			var	container = project.thumbnail.parentNode;
				toggleClass(container, 'thumbnail-hover', 1);
				preview = cre('img', container);
				preview.className = 'thumbnail larger';
			}

			canvas = getResizedCanvasFromImg(fullImage, PREVIEW_SIZE);
			if (canvas) {
				setImageSrc(preview, canvas.toDataURL());
			}
		}
	}
}

function getProjectViewImage(project, img) {
	if (
		project
	&&	project.toPng
	&&	(img = project.toPng())
	) {
		img.onload = () => setProjectThumbnail(project, img);

		if (img.complete) img.onload();

	var	container = createProjectView(project)
	,	header = gt('header', container)[0]
	,	footer = gt('footer', container)[0]
	,	comment = (
			footer
			? cre('header', footer, footer.firstElementChild)
			: header || cre('header', container)
		);

		comment.innerHTML = getLocalizedHTML('error_options');

	var	preview = cre('div', container)
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
	var	paramStart = name.indexOf('[');

//* no "[param]", nothing else to see:

		if (paramStart < 0) {
			return false;
		}

	var	commentStart = name.indexOf('(');

//* has "[param]" and no "(comment)":

		if (commentStart < 0) {
			return true;
		}

//* has "[param]" before "(comment)":

		if (paramStart < commentStart) {
			return true;
		}

	var	commentEnd = name.indexOf(')', commentStart);

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
	var	collection = getOrInitChild(params, paramType, Array);

		values.forEach(
			(value) => addToListIfNotYet(collection, value)
		);
	}

	function addUniqueParamPartsToList(sectionName, listName, value) {
	var	section = getOrInitChild(params, sectionName)
	,	collection = getOrInitChild(section, listName, Array)
		;

		addToListIfNotYet(collection, value);
	}

	function getWIPLayerPathText() {
		return getLayerPathText(layer.parent) + '"' + (layer.nameOriginal || layer.name) + '"';
	}

	if (!layer) {
		layer = {name: 'dummy'};
	}

var	params = getOrInitChild(layer, 'params');

	if (!isArray(paramList)) {
		return layer;
	}

	paramList = paramList.filter(arrayFilterUniqueValues);

	param_list:
	for (let param of paramList) {
	var	match, key, values;

		param_types:
		for (let paramType in regLayerNameParamType) if (match = param.match(regLayerNameParamType[paramType])) {

			if (NAME_PARTS_FOLDERS.indexOf(paramType) >= 0) {
				layer.type = paramType;
				layer.isVisibilityOptional = true;
			} else
			if (paramType === 'zoom' || paramType === 'opacities') {
			var	values = getUniqueNumbersArray(match[1])
			,	format = orz(match[2])
			,	collection = params[paramType]
				;

				if (collection) {
					values.forEach(
						(value) => addToListIfNotYet(collection.values, value)
					);

					collection.format = format;
				} else {
					params[paramType] = {
						'values': values
					,	'format': format
					};
				}
			} else
			if (paramType === 'radius') {
				layer.isVisibilityOptional = true;

			var	paramTextParts = (
					param
					.split('/')
					.filter(arrayFilterNonEmptyValues)
					.map((text) => text.toLowerCase())
				)
			,	methods = []
			,	thresholds = []
			,	boundaries = []
				;

				paramTextParts.forEach(
					(paramTextPart) => {

				//* methods:

						if (PARAM_KEYWORDS_SHORTCUT_FOR_ALL.indexOf(paramTextPart) >= 0) {
							PARAM_KEYWORDS_PADDING_METHODS.forEach(
								(keyword) => addToListIfNotYet(methods, keyword)
							);
						} else
						if (PARAM_KEYWORDS_PADDING_METHODS.indexOf(paramTextPart) >= 0) {
							addToListIfNotYet(methods, paramTextPart);
						} else

				//* thresholds:

						if (
							hasPrefix(paramTextPart, 'at')
						||	(paramTextPart.replace(regNumDots, '') === 'a')
						) {
							// paramTextPart
							// .replace(regTrimParamRadius, '')
							// .split(regNaNorDot)
							// .filter(arrayFilterNonEmptyValues)
							// .forEach(
								// (rangeText) => addRangeToList(thresholds, rangeText)
							// );

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
						var	isHollow = false
						,	dimensions = (
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
							)
						,	explicitDimensions = (
								dimensions
								.map(
									(dimensionBoundaries) => {
										if (isArray(dimensionBoundaries)) {
											if (dimensionBoundaries.length > 1) {
												isHollow = true;
											}

										var	explicitBoundaries = (
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
							)
						,	isBox = (explicitDimensions.length > 1)
						,	isRound = (explicitDimensions.length === 1) && (dimensions.length === 1)
						,	isSquare = (explicitDimensions.length === 1) && (dimensions.length > 1)
						,	count = 0
							;

							if (isRound || isSquare) {
							var	directions = explicitDimensions[0]
							,	addToBoundaryList = (
									isRound
									? function(interval) {
										count += addToListIfNotYet(
											boundaries
										,	{
												'radius': interval
											}
										);
									}
									: function(interval) {
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
									,	function() {
										var	interval = {
												'in': Math.min(...arguments)
											,	'out': Math.max(...arguments)
											};

											addToBoundaryList(interval);
										}
									);
								} else {
									directions[0].forEach(
										(outerRadius) => {
										var	interval = (
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
				var	collection = getOrInitChild(params, paramType, Array);

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
							,	orderedJSONstringify(
									{method, threshold, dimensions}
								)
							);
						}
					);
				}
			} else
			if (paramType === 'copypaste') {
				addUniqueParamPartsToList(paramType, match[1], match[2]);
			} else
			if (paramType === 'multi_select') {
				values = (
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
				key = 'last';
				params[param.indexOf(key) >= 0 ? key : paramType] = true;
			} else
			if (paramType === 'batch') {
				params[param === paramType ? paramType : 'single'] = true;
			} else
			if (paramType === 'autocrop') {
				values = (
					(match[2] || DEFAULT_AUTOCROP)
					.split('/')
					.filter(arrayFilterNonEmptyValues)
				);

				addUniqueParamValuesToList(paramType, values);
			} else
			if (paramType === 'collage') {
				values = (
					(match[2] || DEFAULT_COLLAGE)
					.split('/')
					.filter(arrayFilterNonEmptyValues)
				);

				values.forEach(
					(value) => {
					var	match
					,	listName = 'background'
					,	keyword = value.replace(regNonAlphaNum, '').toLowerCase()
						;

						if (
							PARAM_KEYWORDS_COLLAGE_ALIGN.indexOf(keyword) >= 0
						||	PARAM_KEYWORDS_SHORTCUT_FOR_ALL.indexOf(keyword) >= 0
						) {
							listName = 'align';
						} else
						if (match = value.match(regEndsWithNumPx)) {
							listName = match[1];

							if (
								!listName
							||	PARAM_KEYWORDS_COLLAGE_PAD.indexOf(listName) < 0
							) {
								listName = PARAM_KEYWORDS_COLLAGE_PAD;	//* <- add all with same value
							}

						var	values = (
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
					if (
						(key = match[2])
					&&	(key = key[0])
					) {
						if (key === 'h') layer.flipSide = orz(layer.flipSide) | FLAG_FLIP_HORIZONTAL;
						if (key === 'v') layer.flipSide = orz(layer.flipSide) | FLAG_FLIP_VERTICAL;
					}
				}

				params[paramType] = param || paramType;
			}

			// if (TESTING) console.log('param type [' + paramType + '], value = [' + param + '] at: ' + getWIPLayerPathText());

			// break param_types;
			continue param_list;
		}

		if (value = getRGBAFromColorCodeOrName(param)) {
			params.color_code = value;

			continue param_list;
		}

		if (TESTING) console.log('param type unknown, value = [' + param + '] at: ' + getWIPLayerPathText());
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

var	paramList = []
,	params = {}
	;

	if (typeof layer.sourceData   === 'undefined') layer.sourceData   = sourceData;
	if (typeof layer.nameOriginal === 'undefined') layer.nameOriginal = name;

	name = name.replace(regTrimCommaSpace, '');

var	checkVirtualPath = (
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

	while (match = name.match(regLayerNameParamOrComment)) if (
		checkVirtualPath
	&&	(separator = match[2])
	&&	(separator === '/')
	) {
	var	match, separator
	,	subLayer = layer
	,	isSubLayerFolder = isLayerFolder
		;

		isLayerFolder = true;
		name          = match[1].replace(regTrimCommaSpace, '');
		subLayer.name = match[4].replace(regTrimCommaSpace, '');
		layer = {
			nameOriginal: layer.nameOriginal
		,	isClipped: layer.isClipped
		,	isVirtualFolder: true
		,	isPassThrough: true
		,	isVisible: true
		,	blendMode: BLEND_MODE_NORMAL
		,	opacity: 1
		,	layers: []
		};

		subLayer.isClipped = false;

		break;
	} else {

//* gather "[params]", remove "(comments)":

	var	paramGroupText = match[3];

		if (isNotEmptyString(paramGroupText)) {
			paramGroupText
			.split(regLayerNameParamSplit)
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

	var	layerType = layer.type;

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
					if (NAME_PARTS_FOLDERS.indexOf(layerType) >= 0) {
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

var	paramName = 'check_order'
,	parentValue
	;

	if (
		!params[paramName]
	&&	(parentValue = getPropByNameChain(getParentLayer(layer), 'params', paramName))
	) {
		params[paramName] = parentValue;
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
	for (let layer of layers) {

		if (isStopRequestedAnywhere(project)) {
			return false;
		}

		await callback(layer, parentGroup);
	}

	return true;
}

//* Page-specific functions: internal, loading from file *---------------------

async function loadCommonWrapper(project, libName, fileParserFunc, treeConstructorFunc) {
	if (!(await loadLibOnDemandPromise(libName))) {
		return;
	}

var	actionLabel = 'opening with ' + libName;

	logTime('"' + project.fileName + '" started ' + actionLabel);

	project.loading.startParsingTime = getTimeNow();

	try {
	var	loadingData = project.loading.data
	,	sourceData = await fileParserFunc(
			loadingData.url
			? (loadingData.file = await getFilePromiseFromURL(loadingData.url, 'blob'))
			: loadingData.file
		);
	} catch (error) {
		logError(arguments, error);
	}

	logTime(
		'"' + project.fileName + '"'
	+	(
			sourceData
			? ' finished ' + actionLabel + ', took '
			: (
				isStopRequestedAnywhere(project)
				? ' stopped by request '
				: ' failed '
			) + actionLabel + ' after '
		)
	+	(getTimeNow() - project.loading.startParsingTime)
	+	' ms'
	);

	if (isStopRequestedAnywhere(project)) {
		return;
	}

	if (sourceData) {
		project.sourceData = sourceData;
		project.toPng = thisToPng;

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
	,	async function fileParserFunc(file) {
			return await new Promise(
				(resolve, reject) => {
					ora.load(file, resolve);
				}
			);
		}
	,	async function treeConstructorFunc(project, sourceData) {
			if (!sourceData.layers) return;

			project.layersCount = orz(sourceData.layersCount);
			project.foldersCount = orz(sourceData.stacksCount);

			if (!project.layersCount) return;

			project.width	= sourceData.width;
			project.height	= sourceData.height;

//* gather layers into a tree object:

			async function addLayerToTree(layer, parentGroup) {
			var	name	= layer.name || ''
			,	mode	= layer.composite || ''
			,	mask	= layer.mask || null
			,	layers	= layer.layers || null
			,	blendMode = getNormalizedBlendMode(mode)
			,	isLayerFolder = (layers && layers.length > 0)
			,	isPassThrough = (
					blendMode === BLEND_MODE_PASS
				||	layer.isolation === 'auto'
				)
			,	isClipped = (
					blendMode === BLEND_MODE_CLIP
				||	getTruthyValue(layer.clipping)		//* <- non-standard, for testing
				)
			,	isVisible = (
					typeof layer.visibility === 'undefined'
				||	layer.visibility === 'visible'
				||	layer.visibility !== 'hidden'
				||	getTruthyValue(layer.visibility)	//* <- non-standard, for testing
				)
			,	layerWIP = {
					top:    orz(layer.top    || layer.y)
				,	left:   orz(layer.left   || layer.x)
				,	width:  orz(layer.width  || layer.w)
				,	height: orz(layer.height || layer.h)
				,	opacity: orzFloat(layer.opacity)
				,	isVisible: isVisible
				,	isClipped: isClipped
				,	isPassThrough: isPassThrough
				,	blendMode: blendMode
				,	blendModeOriginal: mode
				};

//* Note: layer masks also may be emulated via compositing modes in ORA

				if (mask) {
				var	img = getPropByAnyOfNamesChain(mask, 'img', 'image');	//* <- already loaded img element

					layerWIP.mask = {
						top:    orz(mask.top   || mask.y)
					,	left:   orz(mask.left  || mask.x)
					,	width:  orz(img.width  || mask.width)
					,	height: orz(img.height || mask.height)
					,	img: img
					};
				}

				parentGroup = await getNextParentAfterAddingLayerToTree(
					layerWIP
				,	layer
				,	name
				,	parentGroup
				,	isLayerFolder
				);

				if (isLayerFolder) {
					await addLayerGroupCommonWrapper(project, parentGroup, layers, addLayerToTree);
				}
			}

			return await addLayerGroupCommonWrapper(
				project
			,	project.layers = []
			,	sourceData.layers
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
	,	async function fileParserFunc(file) {
			return await window[varName].fromDroppedFile(file);
		}
	,	async function treeConstructorFunc(project, sourceData) {
			if (!sourceData.layers) return;

			project.layersCount = sourceData.layers.length;
			project.foldersCount = 0;

			if (!project.layersCount) return;

		var	projectHeader = sourceData.header || sourceData
		,	layerMasks = getPropByNameChain(sourceData, 'layerMask', 'obj', 'layers')
		,	projectMode = projectHeader.mode
			;

			project.width		= projectHeader.cols;
			project.height		= projectHeader.rows;
			project.bitDepth	= projectHeader.depth;
			project.channels	= projectHeader.channels;
			project.colorMode	= (
				isNaN(projectMode)
				? projectMode
				: PSD_COLOR_MODES[projectMode]
			);

//* gather layers into a tree object:

			async function addLayerToTree(layer, parentGroup) {
			var	node	= layer
			,	layer	= node.layer  || node
			,	name	= layer.name  || node.name  || ''
			,	img	= layer.image || node.image || null
			,	mask	= layer.mask  || node.mask  || img.mask || null
			,	mode		= getPropByAnyOfNamesChain(layer, 'blendMode', 'mode')
			,	clipping	= getPropByAnyOfNamesChain(layer, 'blendMode', 'clipped', 'clipping')
			,	modePass	= getPropByNameChain(layer, 'adjustments', 'sectionDivider', 'obj', 'blendMode')

//* Note: "fill" opacity is used by SAI2 instead of usual one for layers with certain blending modes when exporting to PSD.
//* source: https://github.com/meltingice/psd.js/issues/153#issuecomment-436456896

			,	fillOpacity = (
					isFunction(layer.fillOpacity)
					? getNormalizedOpacity(layer.fillOpacity().layer.adjustments.fillOpacity.obj.value)
					: 1
				)
			,	layers = (
					node.hasChildren()
					? node.children()
					: null
				)
			,	blendMode = getNormalizedBlendMode(mode)
			,	isLayerFolder = (layers && layers.length > 0)
			,	isPassThrough = (
					regLayerBlendModePass.test(modePass)
				||	regLayerBlendModePass.test(blendMode)
				)
			,	layerWIP = {
					top:    orz(layer.top)
				,	left:   orz(layer.left)
				,	width:  orz(layer.width)
				,	height: orz(layer.height)
				,	opacity: getNormalizedOpacity(layer.opacity) * fillOpacity
				,	isVisible: getTruthyValue(layer.visible)
				,	isClipped: getTruthyValue(clipping)
				,	isPassThrough: isPassThrough
				,	blendMode: blendMode
				,	blendModeOriginal: mode
				};

				if (
					mask
				&&	!(mask.disabled || (mask.flags & 2))	//* <- mask visibility checkbox, supposedly
				&&	img.hasMask
				&&	img.maskData
				) {
					layerWIP.mask = {
						top:    orz(mask.top  || mask.y)
					,	left:   orz(mask.left || mask.x)
					,	width:  orz(mask.width)
					,	height: orz(mask.height)
					,	defaultColor: orz(mask.defaultColor)
					,	maskData: img.maskData		//* <- RGBA byte array
					};
				}

				parentGroup = await getNextParentAfterAddingLayerToTree(
					layerWIP
				,	layer
				,	name
				,	parentGroup
				,	isLayerFolder
				);

				if (isLayerFolder) {
					++project.foldersCount;

					await addLayerGroupCommonWrapper(project, parentGroup, layers, addLayerToTree);
				}
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

var	relevantLayers = getProjectOptionValue(project, sectionName, listName, optionName);

	if (
		isArray(relevantLayers)
	&&	relevantLayers.length > 0
	) {
	var	section = values[sectionName]
	,	oldOptionName = section[listName]
	,	isOptionNameChanged = (oldOptionName !== optionName)
	,	result = false
		;

		if (isOptionNameChanged) {
			section[listName] = optionName;
		}

		for (let layer of relevantLayers) {
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
var	section;

	for (let sectionName in values) if (section = values[sectionName])
	for (let listName in section) {
	var	optionName = section[listName];

		if (!isOptionRelevant(project, values, sectionName, listName, optionName)) {
			return false;
		}
	}

	return true;
}

function getSetOfRelevantValues(project, values) {
var	section
,	resultSet = {}
	;

	for (let sectionName in values) if (section = values[sectionName])
	for (let listName in section) {
	var	optionName = section[listName]
	,	resultSection = getOrInitChild(resultSet, sectionName)
		;

		resultSection[listName] = (
			isOptionRelevant(project, values, sectionName, listName, optionName)
			? optionName
			: ''
		);
	}

	return resultSet;
}

function selectValueByPos(selectBox, targetPosition) {
var	newValue = selectBox.value;

	if (targetPosition === 'top') {
		newValue = selectBox.options[0].value;
	} else
	if (targetPosition === 'bottom') {
		newValue = selectBox.options[selectBox.options.length - 1].value;
	} else
	if (targetPosition === 'init') {
		newValue = selectBox.initialValue;
	} else {
		for (let option of selectBox.options) if (
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
var	optionItem = gt('option', selectBox).find(
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
		&&	NAME_PARTS_PERCENTAGES.indexOf(selectBox.getAttribute('data-section')) >= 0
		&&	selectBox.value === '0%'
			? '' :
			selectBox.value
		)
	);

	return selectBox.value;
}

function setAllValues(project, targetPosition) {
	gt('select', project.container).forEach(
		(selectBox) => selectValueByPos(selectBox, targetPosition)
	);

	if (
		targetPosition === 'init'
	||	targetPosition === 'empty'
	) {
		gy('checkbox', project.container).forEach(
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

	updateBatchCount(project);
	showImg(project);
}

function getAllMenuValues(project, checkSelectedValue) {
var	values = {};

	gt('select', project.container).forEach(
		(selectBox) => {
		var	sectionName = selectBox.getAttribute('data-section')
		,	listName    = selectBox.name
		,	optionLists = getOrInitChild(values, sectionName)
			;

			optionLists[listName] = (
				sectionName === 'collage'
			||	(
					checkSelectedValue
				&&	getPropByNameChain(project, 'options', sectionName, listName, 'params', 'single')
				)
				? [selectBox.value]
				: gt('option', selectBox).map((option) => option.value)
			);
		}
	);

	return values;
}

function getAllValueSets(project, flags) {

	function goDeeper(optionLists, partialValueSet) {
		if (
			optionLists
		&&	optionLists.length > 0
		) {
		var	optionList  = optionLists[0]
		,	sectionName = optionList.sectionName
		,	listName    = optionList.listName
		,	optionNames = optionList.optionNames
		,	optionsLeft = (
				optionLists.length > 1
				? optionLists.slice(1)
				: null
			);

			for (let optionName of optionNames) {
				if (
					getOnlyNames
				&&	stopAtMaxCount
				&&	valueSets.length > MAX_BATCH_PRECOUNT
				) {
					return;
				}

			var	values = JSON.parse(JSON.stringify(partialValueSet || {}))
			,	section = getOrInitChild(values, sectionName)
				;

				section[listName] = optionName;

				if (optionsLeft) {
					goDeeper(optionsLeft, values);
				} else
				if (isSetOfValuesOK(project, values = getSetOfRelevantValues(project, values))) {
				var	fileName = getFileNameByValuesToSave(
						project,
						values,
						{
							addAllListNames: true,
						}
					);

					if (getOnlyNames) {
						addToListIfNotYet(valueSets, fileName);
					} else {
						if (!(fileName in valueSets)) {
							valueSets[fileName] = values;
						}
					}
				}
			}
		}
	}

	if (!isNonNullObject(flags)) {
		flags = {};
	}

const	getOnlyNames		= !!flags.getOnlyNames
,	stopAtMaxCount		= !!flags.stopAtMaxCount
,	checkSelectedValue	= !!flags.checkSelectedValue
,	values = getAllMenuValues(project, checkSelectedValue);

var	valueSets = getOnlyNames ? [] : {}
,	optionLists = []
,	section
,	sectionName
,	optionNames
,	listName
,	maxPossibleCount = 1
	;

	for (let sectionName in values) if (section = values[sectionName])
	for (let listName in section) if (optionNames = section[listName]) {
		optionLists.push({
			'sectionName': sectionName
		,	'listName'   : listName
		,	'optionNames': optionNames
		});
		if (getOnlyNames) {
			maxPossibleCount *= optionNames.length;
		}
	}

	if (
		getOnlyNames
	&&	stopAtMaxCount
	&&	maxPossibleCount > MAX_BATCH_PRECOUNT
	) {
		return null;
	}

	goDeeper(optionLists);

	return valueSets;
}

function getAllValueSetsCount(project) {
var	valueSets = getAllValueSets(
		project
	,	{
			getOnlyNames: true,
			checkSelectedValue: true,
			stopAtMaxCount: MAX_BATCH_PRECOUNT && MAX_BATCH_PRECOUNT > 0,
		}
	);

	return (
		valueSets === null
		? getLocalizedText('too_many')
		: valueSets.length
	);
}

function getUpdatedMenuValues(project, updatedValues) {
var	values = {};

	gt('select', project.container).forEach(
		(selectBox) => {

//* 1) check current selected values:

		var	sectionName   = selectBox.getAttribute('data-section')
		,	listName      = selectBox.name
		,	selectedValue = selectBox.value || ''
		,	hide = false
			;

//* 2) hide irrelevant options:

			if (updatedValues && updatedValues !== true) {
			var	fallbackValue = ''
			,	selectedValueHidden = false
			,	allHidden = true
				;

				gt('option', selectBox).forEach(
					(option) => {
					var	optionName = option.value || ''
					,	hide = !isOptionRelevant(project, updatedValues, sectionName, listName, optionName)
						;

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

			var	hide = (allHidden ? 'none' : '')
			,	container = getThisOrParentByClass(selectBox, 'project-option') || selectBox.parentNode
			,	style = container.style
				;

				selectValue(selectBox, (
					!hide && selectedValueHidden
					? fallbackValue
					: selectedValue
				));

				if (style.display != hide) {
					style.display = hide;
				}
			}

//* 3) get new values after update:

		var	section = getOrInitChild(values, sectionName);

			section[listName] = (
				!hide
			&&	trim(listName = selectBox.name).length > 0
			&&	trim(selectedValue = selectBox.value).length > 0
				? selectedValue
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
var	buffer = project.renderingBuffer;

	if (!buffer) {
	var	realSize = project.width * project.height * 4 * 3	//* <- 2 RGBA pixel buffers + 1 Alpha mask (as RGBA too for convenience)
	,	paddedSize = nextValidHeapSize(realSize)
	,	buffer = project.renderingBuffer = new ArrayBuffer(paddedSize)
		;
	}

	return new Uint8Array(buffer);
}

function drawImageOrColor(project, ctx, img, blendMode, opacity, mask) {

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

			if (TESTING_RENDER) {
				console.log(['blendMode =', blendMode, 'opacity =', opacity, mask ? 'callback with mask' : 'callback']);

			var	logLabelWrap = blendMode + ': ' + project.rendering.nestedLayers.map((layer) => layer.name).join(' / ');
				console.time(logLabelWrap);
				console.group(logLabelWrap);

			var	logLabel = blendMode + ': loading image data';
				console.time(logLabel);
			}

//* get pixels of layer below (B):

			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = BLEND_MODE_NORMAL;

			if (TESTING_RENDER) {
			var	testPrefix = 'tryBlendingEmulation: ' + blendMode + ', layer ';
				addDebugImage(project, canvas, testPrefix + 'below at ' + (ctx.globalAlpha * 100) + '%', 'yellow');
			}

		var	dataBelow = ctx.getImageData(0,0, w,h)
		,	rgbaBelow = dataBelow.data
			;

//* get pixels of layer above (A):

			ctx.clearRect(0,0, w,h);
			ctx.globalAlpha = (isTransition ? 1 : opacity);

			drawImageOrColorInside(img);

			if (TESTING_RENDER) addDebugImage(project, canvas, testPrefix + 'above at ' + (ctx.globalAlpha * 100) + '%', 'orange');

			ctx.globalAlpha = 1;

		var	dataAbove = ctx.getImageData(0,0, w,h)
		,	rgbaAbove = dataAbove.data
			;

//* get pixels of transition mask (M):

			if (isTransition) {
				ctx.clearRect(0,0, w,h);
				ctx.globalAlpha = opacity;

				drawImageOrColorInside(mask || 'white');

				if (TESTING_RENDER) addDebugImage(project, canvas, testPrefix + 'mask at ' + (ctx.globalAlpha * 100) + '%', 'brown');

				ctx.globalAlpha = 1;

			var	maskData = ctx.getImageData(0,0, w,h)
			,	rgbaMask = maskData.data
				;
			}

//* compute resulting pixels linearly into dataAbove, and save result back onto canvas:

			if (TESTING_RENDER) {
				console.timeEnd(logLabel);
				logLabel = blendMode + ': running calculation';
				console.time(logLabel);
			}

		var	isDone = callback(rgbaAbove, rgbaBelow, rgbaMask);

			if (TESTING_RENDER) {
				console.timeEnd(logLabel);
				logLabel = blendMode + ': saving result to canvas';
				console.time(logLabel);
			}

			ctx.putImageData(isDone ? dataAbove : dataBelow, 0,0);

			if (TESTING_RENDER) {
				console.timeEnd(logLabel);
				console.groupEnd(logLabelWrap);
				console.timeEnd(logLabelWrap);
			}

			return isDone;
		}

		function usingAsmJS(rgbaAbove, rgbaBelow, rgbaMask) {
			try {
			var	arrayLength = rgbaAbove.length
			,	uint8array = getOrCreateReusableHeap(project)
			,	env = null
			,	heap = uint8array.buffer
			,	compute = CompositionModule(window, env, heap)
				;

				uint8array.set(rgbaBelow, 0);
				uint8array.set(rgbaAbove, arrayLength);

				if (rgbaMask) uint8array.set(rgbaMask, arrayLength << 1);

				compute[funcName](arrayLength);
				rgbaAbove.set(uint8array.slice(0, arrayLength));

				return true;

			} catch (error) {
				logError(arguments, error);
			}
		}

//* try computing in asm.js:

	var	funcName = blendMode.replace(/\W+/g, '_').toLowerCase();

		if (
			CompositionModule
		&&	CompositionFuncList
		&&	CompositionFuncList.indexOf(funcName) >= 0
		&&	tryEmulation(usingAsmJS)
		) {
			return true;
		}
	}

	if (!ctx || !img) {
		return null;
	}

	if (typeof opacity === 'undefined') opacity = 1;
	if (typeof blendMode === 'undefined') blendMode = BLEND_MODE_NORMAL;

var	canvas = ctx.canvas;

	if (canvas && opacity > 0) {
		ctx.globalCompositeOperation = blendMode;

	var	x = orz(img.left)
	,	y = orz(img.top)
	,	w = canvas.width
	,	h = canvas.height
	,	ctxBlendMode = ctx.globalCompositeOperation
	,	isTransition = !!(mask || blendMode === BLEND_MODE_TRANSIT)
		;

//* use native JS blending if available, or emulation fails/unavailable:

		if (
			ctxBlendMode === blendMode
		||	!tryBlendingEmulation(blendMode)
		) {
			if (TESTING && ctxBlendMode !== blendMode) console.log(['blendMode =', blendMode, 'fallback =', ctxBlendMode]);

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

		function addRoundPadding() {
		const	paddingRadius = Math.abs(orz(arguments[0]))
		,	pixelsAround = Math.ceil(paddingRadius)
		,	startDistance = (isMethodMin ? -Infinity : +Infinity)
			;

			for (let resultY = h; resultY--;) next_result_pixel:
			for (let resultX = w; resultX--;) {

			var	resultByteIndex = getAlphaDataIndex(resultX, resultY, w)
				resultDistance = startDistance
				;

				look_around:
				for (let referenceY, dy = -pixelsAround; dy <= pixelsAround; dy++) if ((referenceY = resultY + dy) >= 0 && referenceY < h) next_pixel_around:
				for (let referenceX, dx = -pixelsAround; dx <= pixelsAround; dx++) if ((referenceX = resultX + dx) >= 0 && referenceX < w) {

				var	referenceAlpha = referencePixels[getAlphaDataIndex(referenceX, referenceY, w)];

					if (referenceAlpha <= threshold) {
						continue next_pixel_around;
					}

				var	referenceDistance = getDistance(dx, dy) + 1 - referenceAlpha/MAX_CHANNEL_VALUE;

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

			var	resultDistanceFloor = Math.floor(resultDistance);

				resultPixels[resultByteIndex] = (
					resultDistanceFloor > paddingRadius
					? MIN_CHANNEL_VALUE
					: (MAX_CHANNEL_VALUE * (1 + resultDistanceFloor - resultDistance))
				);
			}
		}

		function addBoxPadding() {
		const	pixelsAroundX = Math.ceil(Math.abs(orz(arguments[0])))
		,	pixelsAroundY = Math.ceil(Math.abs(orz(arguments[1])))
		,	startAlpha = (isMethodMin ? MAX_CHANNEL_VALUE : MIN_CHANNEL_VALUE)
			;

			for (let resultY = h; resultY--;) next_result_pixel:
			for (let resultX = w; resultX--;) {

			var	resultByteIndex = getAlphaDataIndex(resultX, resultY, w)
			,	resultAlpha = startAlpha
				;

				look_around:
				for (let referenceY, dy = -pixelsAroundY; dy <= pixelsAroundY; dy++) if ((referenceY = resultY + dy) >= 0 && referenceY < h) next_pixel_around:
				for (let referenceX, dx = -pixelsAroundX; dx <= pixelsAroundX; dx++) if ((referenceX = resultX + dx) >= 0 && referenceX < w) {

				var	referenceAlpha = referencePixels[getAlphaDataIndex(referenceX, referenceY, w)];

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

	const	resultImageData = new ImageData(w,h)
	,	resultPixels = resultImageData.data
	,	referencePixels = referenceImageData.data
		;

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

const	w = referenceImageData.width
,	h = referenceImageData.height
,	isMethodMin = (method === 'min')
,	[paddingX, paddingY] = dimensions
	;

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

	function addPaddingByDimensions() {
	var	dimensions = Array.from(arguments).filter(
			(dimension) => isNonNullObject(dimension)
		)
	,	isHollow = dimensions.every(
			(dimension) => (typeof dimension.in !== 'undefined')
		)
	,	resultImageData = getPaddedImageData(
			referenceImageData
		,	method
		,	threshold
		,	dimensions.map((dimension) => dimension.out)
		);

		ctx.putImageData(resultImageData, 0,0);

		if (isHollow) {
		var	cutImageData = getPaddedImageData(
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
		!ctx
	||	!padding
	||	!padding.method
	) {
		return;
	}

	if (ctx.getContext) {
		ctx = ctx.getContext('2d');
	}

var	w = ctx.canvas.width
,	h = ctx.canvas.height
,	referenceImageData = ctx.getImageData(0,0, w,h)
,	{method, threshold, dimensions} = padding
,	threshold = Math.abs(orz(threshold))
,	isBox = ('x' in dimensions)
	;

	if (isBox) {
		addPaddingByDimensions(dimensions.x, dimensions.y)
	} else {
		addPaddingByDimensions(dimensions.radius)
	}
}

function makeCanvasOpaqueAndGetItsMask(project, ctx) {
	project.rendering.layersBatchCount++;

var	canvas = cre('canvas')
,	w = canvas.width  = ctx.canvas.width
,	h = canvas.height = ctx.canvas.height
,	img = ctx.getImageData(0,0, w,h)
	;

	canvas.getContext('2d').putImageData(img, 0,0);

	for (let data = img.data, index = data.length - 1; index >= 0; index -= 4) {
		data[index] = 255;
	}

	ctx.putImageData(img, 0,0);

	return canvas;
}

function addDebugImage(project, canvas, comment, highLightColor) {
	if (TESTING_RENDER && canvas && canvas.toDataURL) {
	var	img = cre('img', project.renderContainer);

		if (project) {
		var	layers = project.rendering.nestedLayers
		,	layer = layers[layers.length - 1]
			;

			img.alt = img.title = [
				'render name: ' + project.rendering.fileName
			,	'render nesting level: ' + layers.length
			,	'render nesting path: ' + layers.map((v) => v.name).join(' / ')
			,	'layer nesting path: ' + getLayerPathText(layer)
			,	'layer name: ' + (layer ? layer.nameOriginal : layer)
			,	'comment: ' + comment
			].join(' \r\n');
		} else {
			img.alt = img.title = comment;
		}

		if (highLightColor) {
			img.style.borderColor = highLightColor;
			img.style.boxShadow = '3px 3px ' + highLightColor;
		}

		img.src = canvas.toDataURL();
	}
}

function getNewCanvas(project) {
	project.rendering.layersBatchCount++;

var	canvas = cre('canvas');

	canvas.width  = project.width;
	canvas.height = project.height;

	return canvas;
}

function getNewCanvasForImg(project, img) {
	project.rendering.layersBatchCount++;

var	canvas = cre('canvas');

	canvas.width  = orz(img.width)  || project.width;
	canvas.height = orz(img.height) || project.height;
	canvas.left   = orz(img.left);
	canvas.top    = orz(img.top);

	return canvas;
}

function getCanvasCopy(project, img) {
	if (!img) {
		return null;
	}

var	canvas = getNewCanvasForImg(project, img)
,	ctx = canvas.getContext('2d')
,	w = canvas.width
,	h = canvas.height
	;

	if (img.getContext) {
		ctx.putImageData(img.getContext('2d').getImageData(0,0, w,h), 0,0);
	} else {
		ctx.drawImage(img, 0,0);
	}

	return canvas;
}

function getCanvasFlipped(project, img, flipSide, flags) {
	if (!img) {
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

var	canvas = getNewCanvasForImg(project, img)
,	ctx = canvas.getContext('2d')
,	w = canvas.width
,	h = canvas.height
	;

	ctx.save();

//* flip: https://stackoverflow.com/a/3129152

	if (flipSide & FLAG_FLIP_HORIZONTAL) {
		ctx.translate(w, 0);
		ctx.scale(-1, 1);
	}

	if (flipSide & FLAG_FLIP_VERTICAL) {
		ctx.translate(0, h);
		ctx.scale(1, -1);
	}

	ctx.drawImage(img, 0,0);

//* restore: https://stackoverflow.com/a/42856420

	ctx.restore();

	return canvas;
}

function getCanvasFilledOutsideOfImage(project, img, fillColor) {
	if (!img) {
		return null;
	}

var	imgElement = img.img || img;

	if (
		!(
			fillColor
		||	img.left
		||	img.top
		)
	||	(
			img.width  == project.width
		&&	img.height == project.height
		)
	) {
		return imgElement;
	}

var	canvas = getNewCanvas(project)
,	ctx = canvas.getContext('2d')
,	w = canvas.width
,	h = canvas.height
,	fillColor = Math.max(0, Math.min(255, orz(fillColor)))
,	flatColorData = ctx.createImageData(w,h)
	;

	flatColorData.data.fill(fillColor);
	ctx.putImageData(flatColorData, 0,0);

var	w = orz(img.width)  || project.width
,	h = orz(img.height) || project.height
,	x = orz(img.left)
,	y = orz(img.top)
	;

	ctx.clearRect(x,y, w,h);
	ctx.drawImage(imgElement, x,y);

	return canvas;
}

function getCanvasBlended(project, imgBelow, imgAbove, mode, maskOpacity) {
var	canvas = getNewCanvas(project)
,	ctx = canvas.getContext('2d')
	;

	if (imgBelow) drawImageOrColor(project, ctx, imgBelow);
	if (imgAbove) drawImageOrColor(project, ctx, imgAbove, mode || BLEND_MODE_CLIP, maskOpacity);

	return canvas;
}

function getCanvasColored(project, values, listName, img) {
var	color
,	optionalColors
,	selectedColors = project.rendering.colors
	;

	if (selectedColors) {
		if (listName in selectedColors) {
			color = selectedColors[listName];
		} else
		if (optionalColors = getSelectedOptionValue(project, values, 'colors', listName)) {
			for (let layer of optionalColors) if (
				layer.isColor
			&&	getLayerPathVisibilityByValues(project, layer, values, listName)
			) {
				color = selectedColors[listName] = getPropByAnyOfNamesChain(layer, 'color', 'img', 'layer');

				break;
			}
		}
	}

	if (color) {
	var	canvas = getCanvasBlended(
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
var	selectedName = getPropByNameChain(values, sectionName, listName)
,	selectedValue = getProjectOptionValue(project, sectionName, listName, selectedName)
	;

	return selectedValue;
}

function getSelectedMenuValue(project, sectionName, listName, defaultValue) {
var	selectBox = gt('select', project.container).find(
		(selectBox) => (
			sectionName === selectBox.getAttribute('data-section')
		&&	listName === selectBox.name
		)
	);

	if (selectBox) {
	var	selectedValue = selectBox.value;

		if (isNotEmptyString(selectedValue)) {
			return selectedValue;
		}
	}

	return defaultValue;
}

function getLayerPathVisibilityByValues(project, layer, values, listName) {
	if (TESTING && !layer.params) {
		console.log(['No params:', project, layer, values, listName]);
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
				? layer.names.some(callback)
				: layer.names.every(callback)
			)
			: callback(layer.name)
		);
	}

	function skipByAnyName(listName) {
	var	selectedName = getPropByNameChain(values, layer.type, listName) || '';

		return (!layer.params.not === !selectedName);
	}

	function skipBySpecificName(optionName) {

		function skipByListName(listName) {
		var	selectedName = getPropByNameChain(values, parent.type, listName) || '';

			return (optionName === selectedName) === isNot;
		}

		return skipByFunc(parent, skipByListName, isNot);
	}

	function getOpacityByAnyName(listNames) {
	var	maxOpacity = -1
	,	unselectable = false
		;

		for (let listName of listNames) {
		var	opacity = getSelectedOptionValue(project, values, 'opacities', listName);

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

var	isVisible = !!(
		layer.isVisible
	||	layer.isVisibilityOptional
	||	layer.params.skip_render
	);

	if (layer.isOnlyForOneSide) {
	var	selectedName = getPropBySameNameChain(values, 'side');

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

var	parent = layer.optionParent;

	if (parent) {
	var	isNot = (!layer.params.not !== !parent.params.not);

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

		function onReturnCleanup() {
			project.rendering.nestedLayers.pop();
		}

	var	names = layer.names
	,	params = layer.params
	,	skipColoring = !!params.if_only			//* <- check logical visibility, but skip recolor
	,	ignoreColors = !!renderParams.ignoreColors	//* <- only care about alpha channel, for mask generation
	,	clippingGroupWIP = !!renderParams.clippingGroupWIP
	,	clippingGroupResult = false
	,	backward = (
			layer.isOrderedBySide
		&&	side === 'back'
		)
	,	flipSide = orz(backward ? layer.flipSide : 0)
	,	PR = project.rendering
		;

		PR.nestedLayers.push(layer);

		PR.nestedLevelMax = Math.max(
			PR.nestedLevelMax
		,	PR.nestedLayers.length
		);

//* step over clipping group to render or skip at once:

		if (
			!clippingGroupWIP
		&&	!ignoreColors
		) {
		var	clippingGroupLayers = []
		,	siblingIndex = indexToRender
		,	siblingLayer
			;

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

	var	opacity;

		if (
			!isLayerRendered(layer)
		||	!(opacity = renderParams.opacity || getLayerVisibilityByValues(project, layer, values))
		) {
			return onReturnCleanup();
		}

//* skip unrelated to alpha composition when getting mask for padding:

	var	blendMode = layer.blendMode;

		if (ignoreColors) {
			if (!regLayerBlendModeAlpha.test(blendMode)) {
				blendMode = BLEND_MODE_NORMAL;
			}

			if (
				layer.isClipped
			&&	layer.clippingLayer
			&&	blendMode === BLEND_MODE_NORMAL
			) {
				return onReturnCleanup();
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

	var	img = null
	,	canvasCopy = null
		;

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
					ignoreColors: ignoreColors
				,	clippingGroupWIP: true
				}
			);

			if (TESTING_RENDER) addDebugImage(project, img, 'clippingGroupResult: img = getRenderByValues', 'cyan');
		} else {

		var	aliases = null
		,	layers = layer.layers || null
			;

//* append copypasted layers to subqueue:

			if (aliases = getPropByNameChain(params, 'copypaste', 'paste')) {
				layers = (
					(layers || [])
					.concat([layer.img])
					.filter(arrayFilterNonEmptyValues)
				);

				aliases.forEach(
					(alias) => (
						getPropByNameChain(project, 'layersForCopyPaste', 'copy', alias)
					||	[]
					).forEach(
						(layer) => addToListIfNotYet(layers, layer)
					)
				);
			}

			if (layers) {

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
						layers = Array.from(layers).reverse();
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

				var	isToRecolor = (
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
						if (
							flipSide
						||	blendMode !== BLEND_MODE_NORMAL
						||	opacity != 1
						||	layer.mask
						||	layer.isMaskGenerated
						) {
							canvasCopy = getCanvasFlipped(project, canvas, flipSide, {isCopyNeeded: true});
						} else {
							layersToRender = layersToRender.slice(0, indexToRender).concat(layers);
							indexToRender = layersToRender.length;

							return onReturnCleanup();
						}
					}

//* render folder contents, isolated or based on result before passthrough:

					img = await getRenderByValues(
						project
					,	values
					,	layers
					,	{
							ignoreColors: (ignoreColors || isToRecolor)
						,	baseCanvas: canvasCopy
						,	opacity: (aliases ? opacity : 0)	//* <- TODO: properly check copypaste visibility
						}
					);

					if (TESTING_RENDER) addDebugImage(project, img, 'folder content result: img = getRenderByValues');
				}
			} else {

//* not a folder:

				img = layer.img;
			}
		}

		if (img) {
		var	mask = null;

			if (clippingGroupResult) {
				opacity = 1;
			} else {

//* get mask of neighbour content, rendered before or after this layer:

				if (layer.isMaskGenerated) {
				var	paddings = names.map(
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
				var	fillColor = orz(mask.defaultColor);

					mask = getCanvasFilledOutsideOfImage(project, mask, fillColor);

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
				canvas = getNewCanvas(project);
				ctx = canvas.getContext('2d');
			}

			if (canvasCopy) {
				drawImageOrColor(project, ctx, img, BLEND_MODE_TRANSIT, opacity, mask);

				if (TESTING_RENDER) addDebugImage(project, canvas, [
					'drawImageOrColor: ' + BLEND_MODE_TRANSIT
				,	'opacity = ' + opacity
				,	'mask = ' + mask
				].join(' \r\n'), 'red');

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

		return onReturnCleanup();
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

	if (project.rendering) {
		if (nestedLayersBatch) {
			project.rendering.layersBatchCount++;
		} else {
			logTime('getRenderByValues - skipped call without layers while rendering.');
			return;
		}
	} else {
		indexToRender = orz(getPropBySameNameChain(values, 'separate'));

		if (indexToRender > 0) {
			if (
				(layers = project.layersTopSeparated)
			&&	(layer = layers[indexToRender - 1])
			) {
			var	layersToRenderOne = (getParentLayer(layer) || project).layers;
			} else {
				logTime('getRenderByValues - skipped call, separate layer not found.');
				return;
			}
		}

		project.rendering = {
			startTime: getTimeNow()
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

var	layersToRender = layersToRenderOne || nestedLayersBatch || project.layers
,	indexToRender = layersToRender.length
,	indexToStop = 0
,	bottomLayer = layersToRender[indexToRender - 1]
,	side = getPropBySameNameChain(values, 'side')
,	colors = getPropByNameChain(values, 'colors') || {}
,	canvas, ctx, layers, layer, mask, clippingMask
	;

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
	var	renderingTime = getTimeNow() - project.rendering.startTime
	,	renderName = project.rendering.fileName
		;

		if (isStopRequestedAnywhere(project)) {
			canvas = ctx = null;

			logTime('getRenderByValues - stopped by request after ' + (renderingTime / 1000) + ' seconds spent.', renderName);
		} else
		if (canvas) {
			canvas.renderingTime = renderingTime;

			logTime(
				'"' + project.fileName + '" rendered in '
			+	[	project.rendering.layersBatchCount + ' canvas elements'
				,	project.rendering.layersApplyCount + ' blending steps'
				,	project.rendering.nestedLevelMax + ' max nesting levels'
				,	(renderingTime / 1000) + ' seconds'
				,	'subtitle'
				].join(', ')
			,	renderName
			);
		} else {
			logTime('getRenderByValues - visible layers not found.', renderName);
		}

		project.rendering = null;
	}

	return canvas;
}

function getFileNameByValues(project, values, flags) {

	function getProcessedSectionName(sectionName) {

		function getProcessedListName(listName) {
		var	optionName = section[listName];

			if (!optionName.length) {
				return;
			}

		var	params = getPropByNameChain(project, 'options', sectionName, listName, 'params');

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
					if (sectionName == 'zoom') {
					var	zoomPercentage = orz(optionName);

						if (
							zoomPercentage == 100
						||	zoomPercentage <= 0
						) {
							return;
						}
					}

					if (
						ZERO_PERCENT_EQUALS_EMPTY
					&&	NAME_PARTS_PERCENTAGES.indexOf(sectionName) >= 0
					&&	orz(optionName) == 0
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

	var	section = values[sectionName];

		if (!section) {
			return;
		}

	var	listNames = Object.keys(section).filter(arrayFilterNonEmptyValues);
		listNames.sort();

		return (
			listNames
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

async function getOrCreateRender(project, render) {
	if (!isNonNullObject(render)) {
		render = {};
	}

var	values    = render.values    || (render.values    = getUpdatedMenuValues(project))
,	refValues = render.refValues || (
		render.refValues = getPatchedObject(
			values
		,	(
				isNotEmptyString(getPropBySameNameChain(values, 'autocrop'))
				? replaceJSONpartsForCropRef
				: replaceJSONpartsForZoomRef
			)
		)
	)
,	refName   = render.refName   || (render.refName   = getFileNameByValuesToSave(project, refValues))
,	fileName  = render.fileName  || (render.fileName  = getFileNameByValuesToSave(project, values))
,	img       = render.img       || (render.img       = await getOrCreateRenderedImg(project, render))
	;

	return render;
}

async function getOrCreateRenderedImg(project, render) {

	function getAndCacheRenderedImgElementPromise(canvas, fileName) {
		return getImagePromiseFromCanvasToBlob(canvas, project).then(
			(img) => {
			var	msec = canvas.renderingTime;

				img.title = img.alt = (
					fileName + '.png'
				+	' \r\n('
				+	img.width + 'x' + img.height
				+	(
						typeof msec === 'undefined'
						? '' :
						', ' + getLocalizedText('render_took_time', msec / 1000)
					)
				+	')'
				);

				prerenders[fileName] = img;

				return img;
			}
		).catch(
			(error) => {
				console.log(error);

				return null;
			}
		);
	}

	if (!render) render = await getOrCreateRender(project);

	if (img = render.img) {
		return img;
	}

var	prerenders = getOrInitChild(project, 'renders')
,	fileName = render.fileName
	;

	if (fileName in prerenders) {
		return prerenders[fileName];
	}

//* let UI update before creating new image:

	await pause(1);

var	values = render.values
,	refName = render.refName
,	img = prerenders[refName]
	;

	if (!(img || isStopRequestedAnywhere(project))) {
		if (fileName == refName) {
		var	canvas = await getRenderByValues(project, values);

			if (isStopRequestedAnywhere(project)) {
				return;
			}

			if (canvas) {
				img = await getAndCacheRenderedImgElementPromise(canvas, refName);
			} else {
				prerenders[fileName] = null;
			}
		} else {
			render = {values: render.refValues};
			render = await getOrCreateRender(project, render);
			img = render.img;
		}
	}

	if (
		img
	&&	(zoomPercentage = orz(getPropBySameNameChain(values, 'zoom')))
	&&	zoomPercentage > 0
	&&	zoomPercentage != 100
	) {
	var	zoomPercentage
	,	zoomRatio = zoomPercentage / 100
	,	canvas = cre('canvas')
	,	w = canvas.width  = Math.max(1, Math.round(zoomRatio * project.width))
	,	h = canvas.height = Math.max(1, Math.round(zoomRatio * project.height))
	,	ctx = canvas.getContext('2d')
		;

		ctx.drawImage(img, 0,0, w,h);

		img = await getAndCacheRenderedImgElementPromise(canvas, fileName);
	}

	if (
		img
	&&	isNotEmptyString(autocrop = getPropBySameNameChain(values, 'autocrop'))
	&&	(crop = getAutoCropArea(img, autocrop))
	) {
		if (
			crop.width > 0
		&&	crop.height > 0
		) {
		var	autocrop, crop
		,	cropValues = getPatchedObject(values, replaceJSONpartsForCropRef)
		,	cropRefName = getFileNameByValuesToSave(project, cropValues)
		,	cropId = [
				'x=' + crop.left
			,	'y=' + crop.top
			,	'w=' + crop.width
			,	'h=' + crop.height
			].join(',');

			cropValues.autocrop = {'autocrop': cropId};
		var	cropName = getFileNameByValuesToSave(project, cropValues);

			if (cropName in prerenders) {
				img = prerenders[fileName] = prerenders[cropName];
			} else
			if (
				crop.width < img.width
			||	crop.height < img.height
			) {
			var	canvas = cre('canvas')
			,	w = canvas.width  = crop.width
			,	h = canvas.height = crop.height
			,	ctx = canvas.getContext('2d')
				;

				ctx.drawImage(img, -crop.left, -crop.top);

				img = prerenders[cropName] = await getAndCacheRenderedImgElementPromise(canvas, fileName);
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

function getNewLineOptionLists(project) {
var	options = project.options
,	optionsForNewLines = {}
	;

	for (let sectionName in options) {
	var	section = options[sectionName];

		for (let listName in section) {
		var	optionList = section[listName];

			if (getPropByNameChain(optionList, 'params', 'newline')) {
			var	listNames = getOrInitChild(optionsForNewLines, sectionName, Array);

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

	for (let sectionName in options) {
	var	section = options[sectionName];

		for (let listName of section) {
		var	optionName = getPropByNameChain(values, sectionName, listName);

			if (optionName !== null) {
			var	optionId = [
					sectionName
				,	listName
				,	optionName
				].join('\n');

			var	e = getChildByAttr(container, 'data-option-id', optionId);

				if (!e) {
					e = cre('div', container);
					e.setAttribute('data-option-id', optionId);
				}

				container = e;
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

	if (!flags.saveToFile) flags.showOnPage = true;

var	logLabel = 'Render all: ' + project.fileName;

	console.time(logLabel);
	console.group(logLabel);

var	startTime = getTimeNow()
,	sets = getAllValueSets(project, {checkSelectedValue: true})
,	lastPauseTime = getTimeNow()
,	setsCountWithoutPause = 0
,	setsCountTotal = Object.keys(sets).length
,	setsCount = 0
,	totalTime = 0
,	renderedImages = []
,	needWaitBetweenDL = (flags.saveToFile && !flags.asOneJoinedImage)
,	optionsForNewLines = getNewLineOptionLists(project)
,	batchContainer, subContainer, img
	;

	if (flags.showOnPage) batchContainer = getEmptyRenderContainer(project); else
	if (flags.asOneJoinedImage) batchContainer = cre('div');

	logTime(
		'"' + project.fileName + '"'
	+	' started rendering ' + setsCountTotal
	+	' sets (listing took ' + (lastPauseTime - startTime)
	+	' ms)'
	);

	for (let fileName in sets) {
	var	startTime = getTimeNow()
	,	img = null
	,	values = sets[fileName]
	,	render = await getOrCreateRender(
			project
		,	{
				'values': values
			,	'fileName': fileName
			}
		);

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

	var	endTime = getTimeNow();
		totalTime += (endTime - startTime);

		setsCount++;
		setsCountWithoutPause++;

//* Note: Chrome skips downloads if more than 10 in 1 second.
//* source: https://stackoverflow.com/a/53841885

		if (
			needWaitBetweenDL
			? (setsCountWithoutPause > 9)
			: (endTime - lastPauseTime > 500)
		) {
			await pause(needWaitBetweenDL ? (100 * setsCountWithoutPause) : 100);

			lastPauseTime = getTimeNow();
			setsCountWithoutPause = 0;
		}

		if (isStopRequestedAnywhere(project)) {
			project.isStopRequested = false;

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

	if (flags.asOneJoinedImage) {

		function getBatchCanvasSize(rootContainer) {
		var	x = 0
		,	y = 0
		,	w = 0
		,	h = 0
		,	element = rootContainer.firstElementChild
			;

			while (element) {
				if (isImageElement(element)) {
					element.batchOffsetX = x;
					element.batchOffsetY = y;

					w = Math.max(w, x + element.width);
					h = Math.max(h, y + element.height);

					x += element.width + joinedPadding;
				} else {
				var	size = getBatchCanvasSize(element);

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
		var	x = 0
		,	y = 0
			;

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

			return {
				x: x + joinedBorder
			,	y: y + joinedBorder
			};
		}

	var	startTime = getTimeNow()
	,	alignImages = getSelectedMenuValue(project, 'collage', 'align') || ''
	,	joinedBorder = Math.max(0, orz(getSelectedMenuValue(project, 'collage', 'border', DEFAULT_COLLAGE_PADDING_OUTSIDE)))
	,	joinedPadding = Math.max(0, orz(getSelectedMenuValue(project, 'collage', 'padding', DEFAULT_COLLAGE_PADDING_INSIDE)))
	,	size = getBatchCanvasSize(batchContainer)
	,	w = size.width
	,	h = size.height
		;

		if (w > 0 && h > 0) {
			w += joinedBorder * 2;
			h += joinedBorder * 2;

		var	canvas = cre('canvas')
		,	ctx = canvas.getContext('2d')
			;

			canvas.width = w;
			canvas.height = h;

			if (
				canvas.width != w
			||	canvas.height != h
			) {
				alert(getLocalizedText('error_canvas_size', w + 'x' + h));
			} else {
			var	backgroundFill = getSelectedMenuValue(project, 'collage', 'background');

				if (
					backgroundFill
				&&	backgroundFill !== 'transparent'
				&&	(backgroundFill = getColorTextFromArray(backgroundFill))
				&&	backgroundFill !== 'transparent'
				) {
					ctx.fillStyle = backgroundFill;
					ctx.fillRect(0,0, w,h);
				}

				for (let img of renderedImages) {
				var	pos = getBatchOffsetXY(img);

					ctx.drawImage(img, pos.x, pos.y);
				}

			var	img = await getImagePromiseFromCanvasToBlob(canvas, project).then(
					(img) => {
						endTime = getTimeNow();
						totalTime = (endTime - startTime);

						img.title = img.alt = (
							project.fileName + '.png'
						+	' \r\n('
						+	w + 'x' + h + ', '
						+	getLocalizedText(
								'collage_took_time'
							,	totalTime / 1000
							,	renderedImages.length
							) + ')'
						);

						return img;
					}
				).catch(
					(error) => {
						console.log(error);

						return null;
					}
				);

				if (img) {
					if (flags.showOnPage) getEmptyRenderContainer(project).appendChild(img);
					if (flags.saveToFile) saveDL(img.src, project.fileName + '_' + renderedImages.length, 'png', 1);
				}
			}
		}
	}

	console.groupEnd(logLabel);
	console.timeEnd(logLabel);

	setProjectWIPstate(project, false);
}

function showAll(project) {renderAll(project);}
function saveAll(project) {renderAll(project, {saveToFile: true});}
function showJoin(project) {renderAll(project, {asOneJoinedImage: true});}
function saveJoin(project) {renderAll(project, {saveToFile: true, asOneJoinedImage: true});}

async function showImg(project, render, container) {
	if (!render) var isSingleWIP = setProjectWIPstate(project, true);

	try {

//* cleanup before showing rendering steps:

		if (TESTING_RENDER) {
		var	imgContainer = container || getEmptyRenderContainer(project)
		,	img = await getOrCreateRenderedImg(project, render)
			;
		} else {

//* prepare image before container cleanup to avoid flicker:

		var	img = await getOrCreateRenderedImg(project, render)
		,	imgContainer = container || getEmptyRenderContainer(project)
			;
		}

		if (img) {
			imgContainer.appendChild(img);

//* resize img to thumbnail on button:

			if (!container) {
				setProjectThumbnail(project, img);
			}
		}
	} catch (error) {
		logError(arguments, error);

		project.rendering = null;
	}

	if (isSingleWIP) setProjectWIPstate(project, false);

	return img;
}

async function saveImg(project, render, fileName) {
	if (!render) var isSingleWIP = setProjectWIPstate(project, true);

	try {
		render = await getOrCreateRender(project, render);
	var	img = render.img;

		if (img) {
			saveDL(img.src, fileName || render.fileName, 'png');
		}
	} catch (error) {
		logError(arguments, error);

		project.rendering = null;
	}

	if (isSingleWIP) setProjectWIPstate(project, false);

	return img;
}

async function getRenderedImg(project, render) {
	if (!render) var isSingleWIP = setProjectWIPstate(project, true);

	try {
	var	img = await getOrCreateRenderedImg(project, render);
	} catch (error) {
		logError(arguments, error);

		project.rendering = null;
	}

	if (isSingleWIP) setProjectWIPstate(project, false);

	return img;
}

function getEmptyRenderContainer(project) {
	return delAllChildNodes(
		project.renderContainer
	||	(project.renderContainer = gc('project-render', project.container)[0])
	);
}

async function updateMenuAndShowImg(project) {
	if (
		!project
	||	project.isBatchWIP
	||	project.rendering
	||	project.loading
	) {
		if (project.isBatchWIP) logTime('updateMenuAndRender - skipped while batch work is in progress.');
		if (project.rendering) logTime('updateMenuAndRender - skipped while already rendering.');
		if (project.loading) logTime('updateMenuAndRender - skipped while loading project.');

		return;
	}

	return await showImg(project);
}

function updateCheckBox(checkBox, params) {
	if (params || (params = checkBox.params)) {
	var	switchType = checkBox.getAttribute('data-switch-type')
	,	switchName = SWITCH_NAMES_BY_TYPE[switchType]
	,	targetState = !!checkBox.checked
		;

		params[switchName[0]] = !targetState;
		params[switchName[1]] = targetState;
	}
}

function updateBatchCount(project) {
var	precounts = getOrInitChild(project, 'renderBatchCounts')
,	key = (
		(
			gc('batch-checkbox', project.container)
			.map((checkBox) => (checkBox.checked ? 1 : 0))
			.join('')
		)
	+	'_'
	+	getFileNameByValues(project)
	)
,	count = precounts[key]
	;

	if (!count) {
		count = getAllValueSetsCount(project);

		if (
			MAX_BATCH_PRECOUNT
		&&	MAX_BATCH_PRECOUNT > 0
		&&	count > MAX_BATCH_PRECOUNT
		) {
			count = MAX_BATCH_PRECOUNT + '+';
		}

		precounts[key] = count;
	}

	if (ADD_COUNT_ON_BUTTON_LABEL) {
		['show_all', 'save_all'].forEach(
			(name) => gn(name, project.container).forEach(
				(button) => {
				var	label = button.lastElementChild || cre('span', button);
					label.className = 'count-label';
					label.textContent = count;
				}
			)
		);
	} else {
	var	labelClass = 'count-line'
	,	label = gc(labelClass, project.container)[0]
		;

		if (!label) {
		var	container = gn('show_all', project.container)[0] || project.container
		,	container = getThisOrParentByTagName(container, 'section')
		,	label = cre('div', container, container.lastElementChild)
			;

			label.className = labelClass;
		}

		label.textContent = (
			getLocalizedOrEmptyText(getLocalizedKeyByCount('batch_count', count), count)
		||	count
		);
	}
}

function setProjectWIPstate(project, isWIP) {
var	state = !!isWIP;

	project.isStopRequested = false;
	project.isBatchWIP = state;

	['button', 'select', 'input'].forEach(
		(tagName) => gt(tagName, project.container).forEach(
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

	return state;
}

function setGlobalWIPstate(isWIP) {
var	state = !!isWIP;

	isStopRequested = false;
	isBatchWIP = state;

	gt('button', gc('menu-bar')[0]).forEach(
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
var	evt = eventStop(evt, FLAG_EVENT_STOP_IMMEDIATE);

	if (!TESTING && id('loaded-files-view').firstElementChild) {

//* Note: given message text won't be used in modern browsers.
//* source: https://habr.com/ru/post/141793/

	var	message = getLocalizedText('confirm_close_page');

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
	updateDropdownMenuPositions(evt);

//* TODO: find zoom/scale of the screen/page before regenerating thumbnails.
	// thumbnailPlaceholder = null;
}

function updateDropdownMenuPositions(evt) {
	eventStop(evt, FLAG_EVENT_STOP_IMMEDIATE);

	gc('menu-hid').forEach(
		(menuPanel) => putInView(menuPanel, 0,0, true)
	);
}

function onPageKeyPress(evt) {
var	evt = evt || window.event;

//* Esc:

	if (evt.keyCode === 27) {
		gn('stop').forEach(
			(button) => button.click()
		);

		gc('loading', id('loaded-files-selection')).forEach(
			(button) => {
				(button.project || button).isStopRequested = true;
			}
		);
	}
}

function onProjectButtonClick(evt) {
var	evt = evt || window.event
,	button = evt
	;

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

var	container = getProjectContainer(button)
,	project = container.project
,	action = button.name
,	resetPrefix
	;

	if (action === 'stop') {
		project.isStopRequested = true;
	} else
	if (action === 'show') showImg(project); else
	if (action === 'save') saveImg(project); else
	if (action === 'show_all') showAll(project); else
	if (action === 'save_all') saveAll(project); else
	if (action === 'show_join') showJoin(project); else
	if (action === 'save_join') saveJoin(project); else
	if (hasPrefix(action, resetPrefix = 'reset_to_')) {
		setAllValues(project, action.substr(resetPrefix.length));
	} else
	if (action === 'console_log') {
		console.log(project);

		alert(getLocalizedText('see_console'));
	} else {
		console.log([
			evt
		,	button
		,	container
		,	project
		,	'Unknown action: ' + action
		]);

		alert(getLocalizedText('unknown_button', action));
	}
}

function onProjectMenuUpdate(evt) {
var	evt = evt || window.event
,	element = evt
	;

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

var	isSelect = isSelectElement(element);

	if (isSelect) {
		updateSelectStyle(element);

		if (element.getAttribute('data-section') === 'collage') {
			return;
		}
	}

var	container = getProjectContainer(element)
,	project = container.project
	;

	updateBatchCount(project);

	if (isSelect) {
		updateMenuAndShowImg(project);
	}
}

function onPageDragOver(evt) {
var	evt = eventStop(evt, FLAG_EVENT_NO_DEFAULT)
,	batch = evt.dataTransfer
,	files = batch.files
,	items = batch.items
	;

	batch.dropEffect = (
		(files && files.length)
	||	(items && items.length && Array.from(items).some((item) => (item.kind === 'file')))
		? 'copy'
		: 'none'
	);
}

function onPageDrop(evt) {
var	evt = eventStop(evt, FLAG_EVENT_NO_DEFAULT)
,	filesToLoad = []
,	files, name, ext
	;

//* get list of files to process:

	for (let batch of [
		evt.dataTransfer
	,	evt.target
	,	evt.value
	,	evt
	]) if (
		batch
	&&	(files = batch.files)
	&&	files.length
	) {
		for (let file of files) if (
			file
		&&	(name = file.name).length > 0
		&&	(ext = getFileExt(name)).length > 0
		) {
			filesToLoad.push({
				evt: evt
			,	file: file
			,	name: name
			,	ext: ext
			});
		}
	}

//* process files:

	loadFromFileList(filesToLoad, evt);
}

async function loadFromFileList(files, evt) {
	if (
		files
	&&	files.length > 0
	) {
	var	logLabel = 'Load ' + files.length + ' project files: ' + getNestedFilteredArrayJoinedText(files.map((file) => file.name), ', ')
	,	loadedProjectsCount = 0
		;

		console.time(logLabel);
		console.group(logLabel);

		for (let file of files) {
			if (await addProjectView(file)) {
				++loadedProjectsCount;
			}
		}

		console.groupEnd(logLabel);
		console.timeEnd(logLabel);

		console.log('Loaded ' + loadedProjectsCount + ' of ' + files.length + ' project files.');
	} else if (TESTING) {
		console.log(['Cannot load files:', files, 'From event:', evt]);
	}

	return loadedProjectsCount;
}

async function loadFromURL(url) {
	if (!url) {
		return;
	}

var	logLabel = 'Load project from url: ' + url;

	console.time(logLabel);
	console.group(logLabel);

var	isProjectLoaded = await addProjectView({url: url});

	console.groupEnd(logLabel);
	console.timeEnd(logLabel);

	return isProjectLoaded;
}

async function loadFromButton(button, inBatch) {

	function getButtonURL(button) {
	var	url = button.getAttribute('data-url')
	,	container, link
		;

		if (
			!url
		&&	(container = getThisOrParentByClass(button, 'example-file'))
		&&	(link = gt('a', container)[0])
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

var	action, url;

	if (action = button.name || button.getAttribute('data-action')) {
	var	filesTable = getThisOrParentByClass(button, regClassExampleFiles);

		if (action === 'stop') {
			isStopRequested = true;
		} else
		if (action === 'download_all') {
		var	countWithoutPause = 0;

			for (let link of gt('a', filesTable)) if (link.download) {
				link.click();

//* Note: Chrome skips downloads if more than 10 in 1 second.
//* source: https://stackoverflow.com/a/53841885

				if (++countWithoutPause >= 10) {
					await pause(1000);
					countWithoutPause = 0;
				}
			}
		} else
		if (action === 'load_all') {
			setGlobalWIPstate(true);

		var	isProjectLoaded = 0
		,	urls = []
			;

			for (let otherButton of gt('button', filesTable)) if (url = getButtonURL(otherButton)) {
				addToListIfNotYet(urls, url);

				if (await loadFromButton(otherButton, true)) {
					++isProjectLoaded;
				}

				if (isStopRequested) {
					isStopRequested = false;

					break;
				}
			}

			setGlobalWIPstate(false);
		} else {
			console.log([button, filesTable, 'Unknown action: ' + action]);
		}
	} else
	if (url = getButtonURL(button)) {

//* show loading status:

	var	className = 'loading'
	,	fileRow = getThisOrParentByClass(button, regClassExampleFile)
		;

		if (fileRow && fileRow.className) {
			if (fileRow.className.indexOf(className) < 0) {
				toggleClass(fileRow, className, 1);
			} else {
				return;
			}
		}

//* process the file:

	var	isProjectLoaded = await loadFromURL(url);

//* remove loading status:

		if (fileRow && fileRow.className) {
			toggleClass(fileRow, className, -1);
		}

	}

	if (!inBatch) {
		button.disabled = false;
	}

//* report error to user:

	if (
		!TESTING
	&&	!inBatch
	&&	!isProjectLoaded
	&&	(urls || url)
	&&	(
			isArray(urls) && urls.length > 0
			? urls.some((url) => isURLFromDisk(url))
			: isURLFromDisk(url)
		)
	) {
		await pause(100);

		alert(getLocalizedText('error_file_protocol', '{file}'));
	}

	return isProjectLoaded;
}

function selectProject(buttonTab) {
	if (buttonTab = getProjectButton(buttonTab)) {
	var	otherButtonTab = buttonTab.parentNode.firstElementChild;

		while (otherButtonTab) {
		var	selectedState = (otherButtonTab === buttonTab ? 1 : -1);

			gi(otherButtonTab.id).forEach(
				(element) => toggleClass(element, 'show', selectedState)
			);

			otherButtonTab = otherButtonTab.nextElementSibling;
		}
	}
}

function closeProject(buttonTab) {
	if (buttonTab = getProjectButton(buttonTab)) {
	var	buttonClass = buttonTab.className || ''
	,	fileId = buttonTab.id
	,	project = buttonTab.project
		;

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

	var	revokedBlobsCount = revokeBlobsFromTrackList(project);

		if (revokedBlobsCount) {
			if (TESTING) console.log(['closed project:', project, 'revoked blobs:', revokedBlobsCount]);
		}
	}
}

//* Runtime: prepare UI *------------------------------------------------------

async function init() {
var	logLabelWrap = 'Init';
	console.time(logLabelWrap);
	console.group(logLabelWrap);

var	logLabel = `Init localization "${LANG}"`;
	console.time(logLabel);

	toggleClass(document.body, 'loading', 1);
	await loadLibPromise('localization.' + LANG + '.js');
	document.body.innerHTML = getLocalizedHTML('loading');

	console.timeEnd(logLabel);

//* remember config defaults:

var	configVarDefaults = {}
,	configVarNames = [
		'DEFAULT_ALPHA_MASK_PADDING',
		'DEFAULT_ALPHA_MASK_THRESHOLD',
		'DEFAULT_AUTOCROP',
		'DEFAULT_COLLAGE_ALIGN',
		'DEFAULT_COLLAGE_COLORS',
		'DEFAULT_COLLAGE_PADDING',
		'DEFAULT_COLLAGE_PADDING_INSIDE',
		'DEFAULT_COLLAGE_PADDING_OUTSIDE',
		'PREVIEW_SIZE',
		'THUMBNAIL_SIZE',
		'THUMBNAIL_ZOOM_STEP_MAX_FACTOR',
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

	await loadLibPromise(configFilePath);

	console.timeEnd(logLabel);

//* restore invalid config values to default:

	configVarNames.forEach(
		(varName) => {
		var	configuredValue = orz(window[varName])
		,	invalidBottom = (varName.indexOf('FACTOR') < 0 ? 0 : 1)
			;

			window[varName] = (
				configuredValue > invalidBottom
				? configuredValue
				: configVarDefaults[varName]
			);
		}
	);

//* finalize config values format:

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

//* check loading local files:

	if (RUNNING_FROM_DISK) {
		try {
			canLoadLocalFiles = !!(await getFilePromiseFromURL(fetchTestFilePath));
		} catch (error) {
			canLoadLocalFiles = false;
		}
	} else {
		canLoadLocalFiles = true;
	}

	if (!canLoadLocalFiles) {
		logTime('Init: running from disk, cannot load local files.');
	}

//* load libraries not specific to file formats:

	logLabel = 'Init libraries';
	console.time(logLabel);

	await loadLibPromise(libRootDir + 'composition.asm.js');

	if (CompositionModule = AsmCompositionModule) {
		CompositionFuncList = Object.keys(CompositionModule(window, null, new ArrayBuffer(nextValidHeapSize(0))));
	}

	console.timeEnd(logLabel);

//* create main menu:

	logLabel = 'Init menu: file types';
	console.time(logLabel);

var	todoText = getLocalizedText('todo')
,	todoHTML = '<p>' + getLocalizedHTML('todo') + '</p>'
,	fileTypesByKeys = {}
	;

	fileTypeLoaders.forEach(
		(loader) => {
		var	exts = loader.dropFileExts.map((ext) => ext.toUpperCase())
		,	key = exts.shift()
		,	otherTypesByKey = getOrInitChild(fileTypesByKeys, key, Array)
			;

			exts.forEach(
				(ext) => addToListIfNotYet(otherTypesByKey, ext)
			);
		}
	);

var	supportedFileTypesText = (
		Object.keys(fileTypesByKeys)
		.sort()
		.map(
			(key) => {
			var	text = key
			,	otherTypesByKey = fileTypesByKeys[key]
				;

				if (otherTypesByKey.length > 0) {
					text += ' (' + otherTypesByKey.sort().join(', ') + ')';
				}

				return text;
			}
		)
		.join(', ')
	)
,	openingNotesHTML = getLocalizedHTML('file_notes')
,	menuHTMLparts = {};

	menuHTMLparts.file = (
		'<p>'
	+		getLocalizedHTML('file_select_project')
	+		':'
	+	'</p>'
	+	'<input type="file" onchange="onPageDrop(this)">'
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

	console.timeEnd(logLabel);

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

	var	padCount = orz(rowLength) - orz(tabs.length)
	,	padHTML = (
			padCount == 0
			? '' :
			'<td' + (
				padCount == 1
				? '' :
				' colspan="' + padCount + '"'
			) + '></td>'
		)
	,	tabsHTML = (
			tabs.map(
				([name, label]) => (
					(
						!canLoadLocalFiles
					&&	name.indexOf('download') < 0
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

var	tabsCountMax = 0
,	totalFilesCount = 0
,	examplesHTML = getNestedFilteredArrayJoinedText(
		exampleProjectFiles.map(
			(fileGroup) => {
			var	subdir = fileGroup.subdir || ''
			,	headerHTML = (
					!subdir
					? '' :
					'<header>'
				+		getLocalizedHTML(subdir)
				+		':'
				+	'</header>'
				)
			,	tabsCount = 0
			,	filesCount = fileGroup.files.length
			,	fileListHTML = getNestedFilteredArrayJoinedText(
					fileGroup.files.map(
						(file) => {
						var	fileName = (
								file.length
							&&	file.length > 0
							&&	file[0]
								? file[0]
								: file.name || file || '?'
							)
						,	fileInfo = (
								file.length
							&&	file.length > 1
							&&	file[1]
								? '(' + file[1] + ')'
								: getNestedFilteredArrayJoinedText(
									[
										file.pixels
									,	getFormattedFileSize(file.filesize, file.bytes)
									]
								,	', '
								)
							)
						,	thumbnail = (
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
							)
						,	filePath = getNestedFilteredArrayJoinedText([exampleRootDir, subdir, fileName], '/')
						,	fileURL = filePath + '?version=' + file.modtime.replace(/\W+/g, '_')
						,	nameAttr = encodeTagAttr(fileName)
						,	pathAttr = encodeTagAttr(fileURL)
						,	downloadLink = (
								'<a href="'
							+		pathAttr
							+	'" download="'
							+		nameAttr
							+	'">'
							+		getLocalizedHTML('download_file')
							+	'</a>'
							)
						,	loadButton = (
								!canLoadLocalFiles
								? '' :
								'<button onclick="return loadFromButton(this)">'
							+		getLocalizedHTML('open_example_file')
							+	'</button>'
							)
						,	tabs = [
								fileName
							,	thumbnail
							,	fileInfo
							,	getFormattedTime(file.modtime)
							,	downloadLink
							,	loadButton
							]
						,	tabsHTML = getNestedFilteredArrayJoinedText(
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

			var	batchButtonsHTML = (
					filesCount > 1
					? getExampleButtonsRow(EXAMPLE_CONTROLS, tabsCount)
					: ''
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
	)
,	batchButtonsHTML = (
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
	var	url = getLocalizedOrEmptyText(linkName)
	,	linkAttr = (
			url
			? encodeTagAttr(url) + '" class="external-link'
			: encodeTagAttr(`javascript:alert(getLocalizedText('unknown_link', '${linkName}'))`)
		)
	,	linkText = (
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

	function getArrayCodeReplaceSlashToNewLine() {
		return Array.from(arguments).map(
			(value) => wrap.code.param(
				isFunction(value.split)
				? value.split('/').join('\n')
				: value
			)
		);
	}

var	wrap = {
		'code': {},
		'span': {},
	};

	[
		'comment',
		'folder ignore',
		'ignore',
		'name',
		'nested-layer ignore',
		'param',
		'path',
	].forEach(
		(className) => {
		var	key = className.split(regNonAlphaNum)[0];

			for (let tagName in wrap) {
				wrap[tagName][key] = function() {
					return (
						'<' + tagName + ' class="' + className + '">'
					+		Array.from(arguments).join('')
					+	'</' + tagName + '>'
					);
				};
			}
		}
	);

var	helpSections = {
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
		var	content = OPEN_CLOSE.map(
				(actionName) => {
				var	buttonName = actionName + '_' + toggleName;

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

	menuHTMLparts.help = getNestedFilteredArrayJoinedText([
		getHeaderWithToggleButtons('all_sections')
	,	[
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
		].map(
			(sectionName) => {
			var	content = helpSections[sectionName]
			,	sectionContentHTML = getNestedFilteredArrayJoinedText(
					!isArray(content)
					? (
						content
					||	getLocalizedHTML('help_' + sectionName + '_content')
					)
					: content.map(
						(entry) => [
							(
								!entry.code_sample
								? ''
								: (
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

var	aboutLinks = [
		{
			'header': getLocalizedHTML('about_source')
		,	'links': [
				['https://github.com/f2d/sprite_dress_up', 'GitHub']
			]
		}
	,	{
			'header': getLocalizedHTML('about_lang')
		,	'links': (
				gt('link')
				.filter(
					(element) => (
						element.getAttribute('rel') == 'alternate'
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
	,	{
			'pretext': '<hr>'
		,	'content': getLocalizedHTML('about_notes')
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
						([url, text]) => (
							'<a href="'
						+		encodeTagAttr(url)
						+	(
								url.indexOf('//') < 0
								? '" class="local-link'
								: '" class="external-link'
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

var	menuHTML = getNestedFilteredArrayJoinedText(
		Object.entries(menuHTMLparts).map(
			([menuName, menuHTMLpart]) => getDropdownMenuHTML(
				getLocalizedOrEmptyText(menuName) || todoText
			,	menuHTMLpart || todoHTML
			,	'top-menu-' + menuName
			)
		)
	);

var	toggleTextSizeHTML = (
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

	gc('thumbnail').forEach(
		(element) => {
			if (!element.firstElementChild) {
				setImageSrc(element);
			}
		}
	);

	[
		['section-link', 'help_section_link'],
		['local-link', 'page_version_link'],
		['external-link', 'external_link'],
	].forEach(
		([className, textKey]) => gc(className).forEach(
			(element) => {
			var	url = element.getAttribute('href');

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

	[
		['beforeunload',onBeforeUnload]
	,	['dragover',	onPageDragOver]
	,	['drop',	onPageDrop]
	,	['keypress',	onPageKeyPress]
	,	['resize',	onResize]
	].forEach(
		([eventName, handlerFunction]) => window.addEventListener(eventName, handlerFunction, false)
	);

//* open or restore state of UI parts:

var	button, oldSetting;

	if (
		LS
	&&	(oldSetting = LS[LSKeyBigText])
	&&	FALSY_STRINGS.indexOf(oldSetting) < 0
	) {
		toggleTextSize();
	}

	if (OPEN_FIRST_MENU_TAB_AT_START) {
		toggleClass(gt('header')[0], 'show');

		updateDropdownMenuPositions();
	}

//* ready for user input:

	toggleClass(document.body, 'loading', -1);
	toggleClass(document.body, 'ready', 1);

	console.groupEnd(logLabelWrap);
	console.timeEnd(logLabelWrap);

	logTime('Init: ready to work.');
}

document.addEventListener('DOMContentLoaded', init, false);
