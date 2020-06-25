
//* source file data:
//* TODO: lazy loading only needed images in ORA one by one, as in PSD, after new tree structure is finished.
//* TODO: save as ORA.
//* TODO: whole config in JSON-format?

//* menu:
//* TODO: zoom format in filenames: [x1, x1.00, x100%].
//* TODO: progress/status panel + [stop operation] button.
//* TODO: options menu: add/remove/copy/edit colors and outlines, or all list(s), maybe in textarea.
//* TODO: remember already calculated batch counts and valid lists per project, in a dict with keys like joined list of all options and checkboxes.
//* TODO: <select multiple> <optgroup> <option>?</option> </optgroup> </select>.

//* rendering:
//* TODO: save batch to a single collage/tileset image, optionally arrange and align images.
//* TODO: autocrop options - not batchable (?), project defines default selection and extra options (specific color, etc.).
//* TODO: fix invalid clipping-passthrough interactions (ignore clipping if base layer is in passthrough mode, etc).
//* TODO: fix hiding of clipping group with skipped/invisible/empty base layer.
//* TODO: fix blending mode of base layer in clipping group.
//* TODO: keep track of current root of (possibly nested) copy-pasted layer (in array property with push-pop?) while rendering.
//* TODO: arithmetic emulation of all blending operations, not native to JS.
//* TODO: arithmetic emulation of all operations in 16/32-bit until final result; to be optionally available as checkbox/selectbox.
//* TODO: decode layer data (PSD/PNG/etc) manually without using canvas, to avoid premultiplied-alpha (PMA - in Firefox, not in Chrome) while rendering.
//* TODO: for files without merged image data - render ignoring options, but respecting layer visibility properties. Or buttons to show embedded and/or rendered image regardless of options. Or add this as top-most option for any project, with or without options.

//* other:
//* TODO: keep all parameters single-word if possible.
//* TODO: make visible user manual from notes and examples.
//* TODO: global job list for WIP cancelling instead of spaghetti-coded flag checks.
//* TODO: split functionality into modules to reuse with drawpad, etc.

//* Config *-------------------------------------------------------------------

var	regLayerNameToSkip		= /^(skip)$/i
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
,	regLayerNameParamSplit		= /[\s,_]+/g
,	regLayerNameParamTrim		= getTrimReg('\\s,_')

//* examples of comments: "... (1) ... (copy 2) (etc)"
//* examples of params: "... [param] ... [param,param param_param]"

,	regLayerNameParamType = {
		'skip':		/^(skip)$/i
	,	'skip_render':	/^(skip|no)\W+(render)$/i
	,	'check_order':	/^(?:check\W+)?(?:top|bottom\W+)?(down|up)$/i
	,	'none':		/^(none)$/i
	,	'if_only':	/^(if|in)$/i
	,	'not':		/^(\!|not?)$/i
	,	'any':		/^(\?|any|some)$/i

	,	'copypaste':	/^(copy|paste)(?:\W(.*))?$/i
	,	'color_code':	/^(?:rgba?\W*(\w.+)|(?:hex\W*|#)(\w+))$/i

	,	'colors':	/^(colou?r)s$/i
	,	'parts':	/^(option|part|type)s$/i

	,	'paddings':	/^(outline|pad[ding]*)$/i
	,	'radius':	/^(.*?\d.*)px(?:\W+(.*))?$/i
	,	'wireframe':	/^(?:wire\W*)?(frame|fill)$/i

	,	'opacities':	/^(?:(?:opacit[yies]*)\W*)?(\d[\d\W]*)%(\d*)$/i
	,	'zoom':		/^(?:(?:zoom|scale|x)\W*)(\d[\d\W]*)%(\d*)$/i

	,	'side':		/^(front|back|reverse(?:\W+(h[orizontal]*|v[ertical]*))?)$/i
	,	'separate':	/^(separate|split)$/i

	,	'autocrop':	/^(autocrop)(?:\W(.*))?$/i
	,	'collage':	/^(collage)(?:\W(.*))?$/i
	,	'layout':	/^(inline|newline|rows|columns)$/i

	,	'multi_select':	/^(optional|x(\d[\d\W]*))$/i
	,	'preselect':	/^(preselect|initial|last)$/i
	,	'batch':	/^(batch|no-batch|single)?$/i

	,	'no_prefix':	/^(no-prefix)$/i
	}
/*
examples of layer folder names with parameter syntax:

	"[if not any parts] body"	render contents of this folder if "parts: body" select box value is empty.
	"[if     any parts] body"	render contents of this folder if "parts: body" select box value is non-empty.
	"[if not colors] eyes, hair"	render only those subfolders/layers, which have no names selected in "colors: hair" AND "colors: eyes" select boxes.
	"[if     colors] eyes, hair"	render only those subfolders/layers, which have any of names selected in "colors: hair" OR "colors: eyes" select boxes.

	Note: any amount of whitespace is automatically trimmed around and collapsed inside to single spaces.
	Note: [none] adds empty name to the list of layer's option IDs. Comma-separated empty IDs are discarded.
	Note: [parts/colors] folder with [if/not/any] are intended for logical dependencies, and do not add options to selectable list.
	Note: [colors] folder without [if/not/any] gets replaced with selected color, or skipped if empty value is selected. Any layer inside it is added as option regardless of nesting depth, which is intended for logical-dependent inclusion and same-name overwrites. First one found passing logical criteria from top to bottom is used.

examples of 'copypaste':

	[copy]			(ID = empty string)
	[paste=]

	[copy=alias]		(ID = "alias")
	[paste=alias]

	[copy=1 copy=2]		(ID = any of "1" or "2")
	[paste=1 paste=2]	(create a folder with pasted copies inside for each given ID - both "1" and "2")

	Note: copypaste-specific IDs are unrelated to option IDs.
	Note: layer content or children are not copied in the project layer tree, only referenced during relevance checking or rendering.
	Note: for relevance - all paste targets under given aliases are checked.
	Note: for rendering - all copy sources under given aliases are pasted in order of encounter.

examples of 'color_code':

	[#1]
	[#123]
	[#1234]
	[#112233]
	[#11223344]
	[hex-1F2F3F4F]

	[rgb-255-123-0]
	[rgba-10-20-30-40]

	Note: missing RGB values are set to 0 (partial specification is tolerated, but should not be relied upon).
	Note: missing Alpha value is set to 255 (FF).

examples of 'paddings', 'radius':

	"name [pad 1px]"		defaults to outline mode.
	"name [pad 1px-outline]"	fills a padded mask behind layers above it in the same folder.
	"name [pad 1px-inline]"		TODO: fills a padded mask over layers below it in the same folder.
	"name [pad 1px-enclosed]"	TODO: use a mask enclosed from outer side, fill inner areas and holes.
	"name [pad 1px-boundbox]"	TODO: use bounding rectangle as a mask.
	"name [pad 0px-wireframe]"	TODO: use wireframe as a mask (render b/w-filled image, then convert white into transparency).
	"name [pad 0px-wirefill]"	TODO: render b/w-filled image.
	"name [pad 5px-min]"		for each pixel use min value found inside 5px radius of source alpha.
	"name [pad 5px-max]"		for each pixel use max value found inside 5px radius.
	"name [pad 5px-16]"		for each pixel use 100% alpha if any value inside 5px radius is above threshold 16 of 255.
	"name [pad (1:2x3:4)px]"	[1 to 2] width x [3 to 4] height px radius, rectangle area around each pixel.
	"name [pad (5...1:0...1)px]"	generates same sequence as "5:0/4:0/3:0(...)3:1/2:1/1:1".
	"name [pad (1x/2x/3x)px]"	(1 or 2 or 3) px radius, square area.
	"name [pad (-4:5)px-max]"	[-4 to 5] px radius, rounded area, use max value around.
	"name [pad 1/2/3px-in-min/out-max/enclosed-16]"	cross-variation combo.

	Note: when rendering in outline or wireframe mode, all irrelevant layers are skipped (coloring, clipping, etc).
	Note: use 0px to get mask or image without padding.

examples of 'wireframe':

	[frame]		(TODO)
	[wireframe]	(TODO)
	[wire-frame]	(TODO: recolor this layer into black)

	Note: when rendering wireframe mask, unmarked layers will be recolored into white.

examples of 'opacities':

	[opacity-50/100%]
	[100-50%]	(set opacity of this layer/folder to exactly 100 or 50%)
	[0/30/60/90%1]	(TODO: exactly (0 or 30 or 60 or 90)%, preselect format version 1)
	[optional 0%]	(TODO: optionally hide, otherwise leave default opacity of each layer from document)

examples of 'zoom':

	[zoom-50/100%]
	[x50/100/200%]	(scale to (50 or 100 or 200)%, default shortest format in filenames)
	[x100-50-25%2]	(TODO: scale to (100 or 50 or 25)%, preselect format version 2)

	Note: this option works globally (applied to whole result image), so putting this on topmost root layer for clarity is advised.
	Note: internally, 100% is rendered first regardless of selection, then scaled up/down repeatedly by up to x2, until target scale is met.
	Note: all intermediate results are cached and reused.

examples of 'side':

	[reverse]	(when back side is selected, this folder content will be rendered in reverse order)
	[reverse-hor]	(rendered in reverse order and then flipped horizontally)
	[reverse-ver]	(rendered in reverse order and then flipped vertically)

	[if reverse]
	[back]
	[not front]	(when back side is selected, this layer/folder will be drawn; may be used for different color masks)

	[if not reverse]
	[front]
	[not back]	(when back side is selected, this layer/folder will be skipped)

	Note: any of these will add one global select for all to the menu, with 2 options: front and back.

examples of 'separate':

	[separate]	(layers in the top-most non-single-layer folder will be rendered into series of separate images)

	Note: this option works globally (like zoom), not on the layer where it's written.

examples of 'autocrop':

	[autocrop]			(TODO: remove same-fill bar areas around a copy of rendered image)
	[autocrop=rgb-255-123-0]	(TODO: remove border areas colored as given value; see 'color_code' examples for syntax)
	[autocrop=top-left]		(TODO: remove border areas colored same as pixel in given corner)
	[autocrop=top-left/top-right/bottom-left/bottom-right/transparent]

	Note: this option works globally.
	Note: default = transparent (pixels with zero alpha value).

examples of 'collage':

	[collage=padding-1px]		(TODO: add 1px transparent padding between joined images)
	[collage=border-2px]		(TODO: add 2px transparent padding around the whole collage)
	[collage=3px/rgb-255-123-0]	(TODO: add 3px colored padding around and between; see 'color_code' examples for syntax)
	[collage=top-left]		(TODO: align images in a row to top, align rows to left side)
	[collage=top/bottom]		(TODO: horizontally-centered rows)
	[collage=left/right]		(TODO: vertically-centered rows)
	[collage=top-left/top-right/bottom-left/bottom-right/transparent]

	Note: this option works globally.
	Note: default = top-left alignment, transparent 1px border + 2px padding (for neighbour texture edge interpolation).
	Note: if multiple variants are given, all are added as options.
	Note: alignment has no effect without autocrop, because all images in a project will render with the same canvas size.

examples of 'layout':

	[rows]
	[newline]	(TODO: separate row of images in a batch for each value of options associated with marked layer)

	[columns]
	[inline]	(TODO: separate row of images in a batch for each value of options not associated with marked layer)

	Note: this option works globally.

examples of 'multi_select':

	[optional]	(1 or none)
	[x0-1]		(1 or none)
	[x1+]		(TODO: 1 or more)
	[x2]		(TODO: exactly 2)
	[x]		(TODO: any, from none to all at once)

	Note: [parts] cannot be selected more than 1 at once currently.
	Note: [colors] cannot be selected more than 1 at once (they will overwrite anyway).

examples of 'preselect':

	[preselect]	(TODO: preselect this option initially)
	[initial]
	[last]		(preselect last option in the list; may be empty value, depending on 'multi_select' param)

	Note: default = preselect first option in the list.

examples of 'batch':

	[batch]		(in batch export - iterate the whole option list)
	[no-batch]	(in batch export - use only the single selected option)
	[single]

	Note: first found explicit setting makes the other to be default.
	Note: if all omitted, default = initialize all to batch.

examples of 'no_prefix':

	[no-prefix]	(for export filename - omit option list title)
			(TODO: add prefix automatically only if option names collide?)
*/

,	regLayerBlendModePass	= /^pass[-through]*$/i
,	regLayerBlendModeAlpha	= /^(source|destination)-(\w+)$/i
,	regLayerTypeSingleTrim	= /s+$/i
,	regHasDigit		= /\d/
,	regNaN			= /\D+/g
,	regNonWord		= /\W+/g
,	regSpace		= /\s+/g
,	regCommaSpace		= /\,+s*/g
,	regSplitLayerNames	= /[\/,]+/g
,	regSanitizeFileName	= /[_\s\/\\:<>?*"]+/g
,	regHMS			= /(T\d+)-(\d+)-(\d+\D*)/
,	regTrim			= getTrimReg('\\s')
,	regTrimCommaSpace	= getTrimReg('\\s,')
,	regTrimNaN		= getTrimReg('\\D')
,	regTrimNaNorSign	= getTrimReg('^\\d\\.+-')
,	regTrimNewLine		= /[^\S\r\n]*(\r\n|\r|\n)/g
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

,	regPSD = {
		layerNameEndOfFolder	: /^<\/Layer[\s_]group>$/i
	,	layerTypeFolder		: /^(open|closed)[\s_]folder$/i
	,	layerUnicodeName	: /^Unicode[\s_]layer[\s_]name$/i
	}

,	QUERY_SELECTOR = {
		getElementsByClassName:	['.', ''],
		getElementsByTagName:	['', ''],
		getElementsByName:	['*[name="', '"]'],
		getElementsByType:	['*[type="', '"]'],
		getElementsById:	['*[id="', '"]'],
	}

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

,	RUNNING_FROM_DISK = (location.protocol.split(':', 1)[0].toLowerCase() === 'file')
// ,	LS = window.localStorage || localStorage
,	URL_API = window.URL || window.webkitURL
,	BLOB_PREFIX = 'blob:'
,	DATA_PREFIX = 'data:'
,	TYPE_TEXT = 'text/plain'
,	TOS = ['object', 'string']
,	VIEW_SIDES = ['front', 'back']
,	NAME_PARTS_PERCENTAGES = ['zoom', 'opacities']
,	NAME_PARTS_FOLDERS = ['parts', 'colors']
,	NAME_PARTS_ORDER = ['parts', 'colors', 'paddings', 'opacities', 'side', 'separate', 'zoom', 'autocrop']
,	NAME_PARTS_SEPARATOR = ''
,	SWITCH_NAMES_BY_TYPE = {
		'batch': ['batch', 'single']
	,	'layout': ['inline', 'newline']
	}

,	FLAG_FLIP_HORIZONTAL = 1
,	FLAG_FLIP_VERTICAL = 2

,	SPLIT_SEC = 60
,	MAX_OPACITY = 255
,	MAX_BATCH_PRECOUNT = 1000
,	PADDING_ALPHA_THRESHOLD_DEFAULT = 16
,	THUMBNAIL_SIZE = 16
,	PREVIEW_SIZE = 64
,	JOINED_IMAGE_BORDER = 1
,	JOINED_IMAGE_PADDING = 2

,	ADD_PAUSE_BEFORE_EACH_FOLDER	= true	//* <- when loading file and rendering
,	ADD_PAUSE_BEFORE_EACH_LAYER	= false
,	DOWNSCALE_BY_MAX_FACTOR_FIRST	= true
,	EXAMPLE_NOTICE		= false
,	FILE_NAME_ADD_PARAM_KEY	= true
,	TAB_THUMBNAIL_ZOOM	= true
,	TESTING			= false
,	TESTING_RENDER		= false
,	USE_ZLIB_ASM		= true
,	VERIFY_PARAM_COLOR_VS_LAYER_CONTENT	= false
,	ZERO_PERCENT_EQUALS_EMPTY		= false

,	thumbnailPlaceholder
,	isStopRequested
,	isBatchWIP

,	BLEND_MODE_NORMAL = 'source-over'
,	BLEND_MODE_CLIP = 'source-atop'
,	BLEND_MODE_MASK = 'destination-in'
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

//* Config: loaders of project files *-----------------------------------------

var	exampleRootDir = ''
,	exampleProjectFiles = []
,	libRootDir = 'lib/'
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
		,	'dir': libFormatsDir + 'zip/'
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
			) : []).concat()
		},

		'ora.js': {

//* source: https://github.com/zsgalusz/ora.js

//* no support for ORA in CSP, SAI, etc.
//* not enough supported features in Krita, etc.

//* way: draw in SAI2 → export PSD → import PSD in Krita (loses clipping groups) → export ORA (loses opacity masks)
//* wish: draw in SAI2 → export ORA (all layers rasterized + all blending properties and modes included as attributes)

			'varName': 'ora'
		,	'dir': libFormatsDir + 'ora/'
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

		'PSDLIB.js': {

//* source: https://github.com/Braunbart/PSDLIB.js

//* TODO: layer opacity masks, data decompression methods

			'varName': 'PSDLIB'
		,	'dir': libFormatsDir + 'psd/psdlib/'
		,	'files': [
				// 'psdlib.min.js',
				'psdlib.js',
			]
		}
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
				// loadPSDLIB,
			]
		},
	]
,	ora, zip, PSD, PSD_JS, PSDLIB	//* <- external variable names, do not change, except "PSD_JS"
,	CompositionModule
,	CompositionFuncList
	;

//* Common utility functions *-------------------------------------------------

function isNotEmptyString(v) {
	return (
		TOS.indexOf(typeof v) >= 0
	&&	v.length > 0
	);
}

function isURLFromDisk(url) {
var	match = url.match(/^(\w+):\/+/)
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

function pause(msec) {
	return new Promise(
		(resolve, reject) => {
			setTimeout(resolve, msec || 1000);
		}
	);
}

function dist(x,y) {return Math.sqrt(x*x + y*y)};
function getAlphaDataIndex(x,y,w) {return ((y*w + x) << 2) | 3;}
function repeat(t,n) {return new Array(n+1).join(t);}

function hex2rgbArray(v) {

//* extend shortcut notation:

var	j = v = ''+v
,	i = v.length
	;

	if (i === 1) j = repeat(v, 6); else
	if (i === 2) j = repeat(v, 3); else
	if (i === 3 || i === 4) {
		j = (
			v
			.split('')
			.map(v => repeat(v, 2))
			.join('')
		);
	}
	if (v !== j) v = j;

//* parse string into numbers:

var	a = [];
	while (i = v.length) {
	var	j = Math.min(2, i);
		a.push(parseInt(v.substr(0, j), 16));
		v = v.substr(j);
	}
	return a;
}

function getColorTextFromArray(img) {
	return '' + (
		img && img.join
		? (
			(img.length > 3 ? 'rgba' : 'rgb')
		+	'('
		+		img.slice(0,4).map(orzFloat).join(',')
		+	')'
		)
		: img
	);
}

function getPropByNameChain() {
var	a = Array.from(arguments)
,	o = a.shift()
	;

	while (a.length > 0) {
	var	k = a.shift();

		if (
			typeof k === 'undefined'
		||	typeof o !== 'object'
		) {
			return null;
		}

		o = o[k];
	}
	return o;
}

function getPropByAnyOfNamesChain() {
var	a = Array.from(arguments)
,	o = a.shift()
	;

	deeper: while (typeof o === 'object') {
		prop_names: for (var k of a) if (k in o) {
			o = o[k];
			continue deeper;
		}
		break;
	}
	return o;
}

function getPropBySameNameChain(o,n,p) {
	while (o && (p = o[n])) o = p;
	return o;
}

function cleanupObjectTree(obj, childKeys, keysToRemove) {
	if (obj) {
		Array.from(keysToRemove).forEach(
			k => {
				if (k in obj) {
					obj[k] = null;
					delete obj[k];
				}
			}
		);

		Array.from(childKeys).forEach(
			k => {
			var	v = obj[k];
				if (v) {
					if (v.forEach) {
						v.forEach(v => cleanupObjectTree(v, childKeys, keysToRemove));
					} else {
						cleanupObjectTree(v, childKeys, keysToRemove);
					}
				}
			}
		);
	}

	return obj;
}

function arrayFilterNonEmptyValues(v) {return (typeof v === 'string' ? (v.length > 0) : !!v);}
function arrayFilterUniqueValues(v,i,a) {return a.indexOf(v) === i;}
function arrayFilteredJoin(a,j) {return a.filter(arrayFilterNonEmptyValues).join(j);}

//* https://gist.github.com/wellcaffeinated/5399067#gistcomment-1364265
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

function getElementsArray(by, value, parent) {
	if (!parent) {
		parent = document;
	}

	try {
	var	a = (
			parent[by]
			? parent[by](value)
			: parent.querySelectorAll(QUERY_SELECTOR[by].join(value))
		) || [];

		return (
			Array.from
			? Array.from(a)
			: Array.prototype.slice.call(a)
		);
	} catch (error) {
		console.log(error);
	}

	return [];
}

function gc(n,p) {return getElementsArray('getElementsByClassName', n,p);}
function gt(n,p) {return getElementsArray('getElementsByTagName', n,p);}
function gy(n,p) {return getElementsArray('getElementsByType', n,p);}
function gn(n,p) {return getElementsArray('getElementsByName', n,p);}
function gi(n,p) {return getElementsArray('getElementsById', n,p);}
function id(i) {return document.getElementById(i);}

function cre(e,p,b) {
	e = document.createElement(e);
	if (b) p.insertBefore(e, b); else
	if (p) p.appendChild(e);
	return e;
}

function del(e) {
	var p;
	if (!e) return;
	if (e.map) e.map(del); else
	if (p = e.parentNode) p.removeChild(e);
	return p;
}

function delAllChildNodes(p) {
	var e;
	while (e = p.lastChild) del(e);
	return p;
}

function eventStop(e,i,d) {
	if ((e && e.eventPhase !== null) ? e : (e = window.event)) {
		if (d && e.preventDefault) e.preventDefault();
		if (i && e.stopImmediatePropagation) e.stopImmediatePropagation();
		if (e.stopPropagation) e.stopPropagation();
		if (e.cancelBubble !== null) e.cancelBubble = true;
	}
	return e;
}

function encodeHTMLSpecialChars(t) {
	return String(t)
	.replace(/&/g, '&amp;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#39;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;');
}

function encodeTagAttr(t) {
	return String(t).replace(/"/g, '&quot;');
}

//* propNameForIE:
function dashedToCamelCase(n) {
	return (
		n
		.split('-')
		.map(
			(v,i) => (
				i == 0
				? v
				: v.slice(0,1).toUpperCase() + v.slice(1).toLowerCase()
			)
		)
		.join('')
	);
}

function getStyleValue(e, prop) {
var	o;
	if (o = e.currentStyle) return o[dashedToCamelCase(prop)];
	if (o = window.getComputedStyle) return o(e).getPropertyValue(prop);
	return null;
}

function toggleClass(e,c,keep) {
var	j = orz(keep)
,	k = 'className'
,	old = e[k] || e.getAttribute(k) || ''
,	a = old.split(regSpace).filter(arrayFilterNonEmptyValues)
,	i = a.indexOf(c)
	;

	if (i < 0) {
		if (j >= 0) a.push(c);
	} else {
		if (j <= 0) a.splice(i, 1);
	}
	if (a.length) {
		j = a.join(' ');
		if (old != j) e[k] = j;
	} else
	if (old) {
		e[k] = '';
		e.removeAttribute(k);
	}
}

function getClassReg(c) {return new RegExp('(^|\\s)('+c+')($|\\s)', 'i');}
function getTrimReg(c) {return new RegExp('^['+c+']+|['+c+']+$', 'gi');}

function getChildByAttr(e,k,v) {
	if (e) {
		e = e.firstElementChild;
	}

	while (e) {
		if (e.getAttribute(k) === v) break;
		e = e.nextElementSibling;
	}

	return e;
}

function getPreviousSiblingByClass(e,c) {
var	r = (c.test ? c : getClassReg(c));

	while (e && (e = e.previousElementSibling)) {
		if (e.className && r.test(e.className)) break;
	}

	return e;
}

function getNextSiblingByClass(e,c) {
var	r = (c.test ? c : getClassReg(c));

	while (e && (e = e.nextElementSibling)) {
		if (e.className && r.test(e.className)) break;
	}

	return e;
}

function getThisOrParentByClass(e,c) {
var	r = (c.test ? c : getClassReg(c));

	while (e) {
		if (e.className && r.test(e.className)) break;
		e = e.parentNode;
	}

	return e;
}

function getThisOrParentByTagName(e,t) {
var	t = t.toLowerCase();

	while (e) {
		if (e.tagName && e.tagName.toLowerCase() === t) break;
		e = e.parentNode;
	}

	return e;
}

function getTargetParentByClass(e, c) {
	if (e && e.target) {
		e = e.target;
	}

	e = getThisOrParentByClass(e, c);

	if (e && e.tagName) {
		return e;
	}
}

function getTagAttrIfNotEmpty(name, values, delim) {
	if (name) {
	var	a = (values.filter ? values : [values]).filter(arrayFilterNonEmptyValues);
		if (a.length) return ' '+name+'="'+encodeTagAttr(a.join(delim || ' '))+'"';
	}
	return '';
}

function getDropdownMenuHTML(head, list, id, tagName) {
	if (head && head.map) {
		[head, list, id, tagName] = head;
	}
var	t = tagName || 'div'
,	a = '<'+t+' class="'
,	b = '</'+t+'>'
,	head = ''+head
	;

	return	a+'menu-head"'
	+	getTagAttrIfNotEmpty('id', id || '')
	+	' onmouseover="onResize()">'
	+	(
			head[0] === '<'
		&&	head.slice(-1) === '>'
			? head
			: (
				'<header class="button" onclick="toggleDropdownMenu(this)">'
			+		head
			+	'</header>'
			)
		)
	+	a+'menu-drop">'
	+	a+'menu-hid">'
	+	a+'menu-list">'
	+		(list || '')
	+	b+b+b+b;
}

function toggleDropdownMenu(e) {
var	p = getThisOrParentByClass(e, regClassMenuBar);
	if (p) {
		gc('menu-head', p).forEach(
			v => {
			var	h = gt('header', v)[0];
				if (h && h !== e) {
					toggleClass(h, 'show', -1);
				}
			}
		);
	}
	toggleClass(e, 'show');
}

function getOffsetXY(e) {
var	x = 0
,	y = 0
	;

	while (e) {
		x += e.offsetLeft;
		y += e.offsetTop;
		e = e.offsetParent;
	}
	return {x:x, y:y};
}

function putInView(e,x,y, changeOnlyX, changeOnlyY) {
var	offsetParentX = 0
,	offsetParentY = 0
,	positionType = getStyleValue(e, 'position')
	;

	if (
		positionType === 'absolute'
	&&	(o = e.offsetParent)
	) {
		o = getOffsetXY(o);
		offsetParentX = o.x;
		offsetParentY = o.y;
	}

	if (isNaN(x)) {
		o = getOffsetXY(e);
		x = o.x;
		y = o.y;
	} else {
		x = orz(x) + offsetParentX;
		y = orz(y) + offsetParentY;
	}

var	o = window.visualViewport
,	isPositionFixed = (positionType === 'fixed')
	;

	if (!changeOnlyY) {
	var	x0 = orz(isPositionFixed ? (document.body.scrollLeft || document.documentElement.scrollLeft) : 0)
	,	x1 = x0 + (o ? o.width : window.innerWidth) - e.offsetWidth
		;

		if (x > x1) x = x1;
		if (x < x0) x = x0;

		e.style.left = (x - offsetParentX) + 'px';
	}

	if (!changeOnlyX) {
	var	y0 = orz(isPositionFixed ? (document.body.scrollTop || document.documentElement.scrollTop) : 0)
	,	y1 = y0 + (o ? o.height : window.innerHeight) - e.offsetHeight
		;

		if (y > y1) y = y1;
		if (y < y0) y = y0;

		e.style.top  = (y - offsetParentY) + 'px';
	}

	return e;
}

function trim(t) {
	return (
		typeof t === 'undefined'
	||	t === null
		? ''
		: ('' + t)
			.replace(regTrim, '')
			.replace(regTrimNewLine, '\n')
	);
}

function trimOrz(n,d) {return orz(n.replace(regTrimNaN, ''), d);}
function orz(n,d) {return (isNaN(d) ? parseInt(n||0) : parseFloat(n||d))||0;}
function orzFloat(n) {return orz(n, 0.0);}

function leftPad(n, len, pad) {
	n = '' + orz(n);
	len = orz(len) || 2;
	pad = '' + (pad || 0);
	while (n.length < len) n = pad+n;
	return n;
}

function getNumbersArray(t,n,s,f) {
	return (
		t
		.split(s || regNaN, orz(n) || -1)
		.map(f || orz)
	);
}

function getUniqueNumbersArray(t) {
	return (
		t
		.split(regNaN)
		.map(orz)
		.filter(arrayFilterUniqueValues)
	);
}

function getFileExt(n) {return n.split(/\./g).pop().toLowerCase();}
function getFileName(n) {return n.split(/\//g).pop();}
function getFileBaseName(n) {var i = n.lastIndexOf('.'); return (i > 0 ? n.substr(0, i) : n);}
function getFilePathFromUrl(n) {return n.split(/\#/g).shift().split(/\?/g).shift();}
function getFormattedFileNamePart(n) {return (n.length > 0 ? '[' + n + ']' : n);}

function getFormattedFileSize(shortened, bytes) {
	if (bytes) {
		bytes += ' ' + la.project.bytes;
	}
	if (shortened && bytes) {
		shortened += ' (' + bytes + ')';
	}
	return shortened || bytes;
}

function getFormattedTimezoneOffset(t) {
	return (
		(t = (t && t.getTimezoneOffset ? t : new Date()).getTimezoneOffset())
		? (t < 0?(t = -t, '+'):'-') + leftPad(Math.floor(t/SPLIT_SEC)) + ':' + leftPad(t%SPLIT_SEC)
		: 'Z'
	);
}

function getFormattedHMS(msec) {
var	t = orz(msec)
,	a = [0, 0, Math.floor(Math.abs(t) / 1000)]
,	i = a.length
	;

	while (--i) {
		if (a[i] >= SPLIT_SEC) {
			a[i - 1] = Math.floor(a[i] / SPLIT_SEC);
			a[i] %= SPLIT_SEC;
		}
		if (a[i] < 10) a[i] = '0' + a[i];
	}
	return (t < 0?'-':'') + a.join(':');
}

function getLogTime() {return getFormattedTime(0,0,1);}

function getFormattedTime(sec, for_filename, for_log, plain, only_ymd) {
var	t = sec;
	if (TOS.indexOf(typeof t) >= 0) {
	var	text = '' + t
	,	n = orz(sec)
		;

		if (typeof t === 'string' && Date.parse) {
			t = Date.parse(t.replace(regHMS, '$1:$2:$3'));
		} else {
			t = n * 1000;
		}
		if (!t && text) return text;
	}
var	d = (t ? new Date(t+(t > 0 ? 0 : new Date())) : new Date())
,	a = (
		only_ymd
		? ['FullYear', 'Month', 'Date']
		: ['FullYear', 'Month', 'Date', 'Hours', 'Minutes', 'Seconds']
	).map(function(v,i) {
		v = d['get'+v]();
		if (i == 1) ++v;
		return leftPad(v);
	})
,	YMD = a.slice(0,3).join('-')
,	HIS = a.slice(3).join(for_filename?'-':':') + (for_log?'.'+((+d) % 1000):'')
	;

	return (
		for_log || for_filename || plain
		? YMD + (for_filename?'_':' ') + HIS
		: (
			'<time datetime="'
		+	YMD + 'T'
		+	HIS
		+	getFormattedTimezoneOffset(t)
		+	'" data-t="' + Math.floor(d/1000)
		+	'">'
		+		YMD
		+		' <small>'
		+			HIS
		+		'</small>'
		+	'</time>'
		)
	);
}

function logTime(k, v) {
var	t = getLogTime();
	if (typeof k !== 'undefined') t += ' - ' + k;
	if (typeof v !== 'undefined') {
		if (v.join) v = v.join('\n');
		if (v.indexOf && v.indexOf('\n') >= 0) {
			if (
				(v[0] == '(' && ')' == v.slice(-1))
			||	(v[0] == '{' && '}' == v.slice(-1))
			||	(v[0] == '[' && ']' == v.slice(-1))
			) {
				t += ':\n' + v;
			} else {
				t += ':\n[\n' + v + '\n]';
			}
		} else {
			t += ' = "' + v + '"';
		}
	}
	console.log(t);
}

function readFilePromise(file) {

//* "file" may be a blob object
//* source: https://stackoverflow.com/a/15981017

	return new Promise(
		(resolve, reject) => {
		var	r = new FileReader();
			r.onload = (e) => resolve(e.target.result);
			r.readAsArrayBuffer(file);
		}
	);
}

function readFilePromiseFromURL(url, responseType) {

//* "url" may be a "blob:" or "data:" url
//* source: https://www.mwguy.com/decoding-a-png-image-in-javascript/

	return new Promise(
		(resolve, reject) => {
		var	r = new XMLHttpRequest();

			r.responseType = responseType || 'arraybuffer';
			r.addEventListener('load', (e) => {
			var	response = e.target.response;

				if (response) {
					resolve(response);
				} else{
				var	error = new Error('No response');
					error.event = e;

					reject(error);
				}
			});

			r.addEventListener('error', (e) => {
			var	error = new Error('An error has occurred on request');
				error.event = e;

				reject(error);
			});

			r.open('GET', url, true);
			r.send();
		}
	);
}

function dataToBlob(data) {
	if (URL_API && URL_API.createObjectURL) {
	var	type = TYPE_TEXT;
		if (data.slice(0, k = DATA_PREFIX.length) == DATA_PREFIX) {
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
	var	data = Uint8Array.from(TOS.map.call(data, (v => v.charCodeAt(0))))
	,	size = data.length
	,	url = URL_API.createObjectURL(new Blob([data], {'type': type}))
		;

		if (url) {
			return {
				size: size
			,	type: type
			,	url: url
			};
		}
	}
}

function saveDL(data, fileName, ext, addTime, jsonReplacerFunc) {
var	type = TYPE_TEXT
,	data = (
		typeof data === 'object'
		? JSON.stringify(
			data,
			jsonReplacerFunc || null
			, '\t')
		: ''+data
	);

	if (data.slice(0, BLOB_PREFIX.length) == BLOB_PREFIX) {
	var	dataURI = data
	,	blob = true
		;
	} else
	if (data.slice(0, DATA_PREFIX.length) == DATA_PREFIX) {
		dataURI = data;
	} else {
		dataURI = DATA_PREFIX + type + ',' + encodeURIComponent(data);
	}

var	size = dataURI.length
,	a = cre('a', document.body)
	;

	logTime('saving "' + fileName + '", data = ' + data.length + ' bytes, dataURI = ' + size + ' bytes');

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
				? getFormattedTime(0,1)
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

			a.href = ''+dataURI;
			a.download = fileName;
			a.click();

			logTime('saving "' + fileName + '"');
		} catch (error) {
			console.log(error);
		}
	} else {
		window.open(dataURI, '_blank');

		logTime('opened file to save');
	}

	setTimeout(
		function() {
			if (blob) URL_API.revokeObjectURL(blob.url);
			del(a);
		}
	,	Math.max(Math.ceil(size / 1000), 12345)
	);

	return size;
}

function loadLib(lib) {
	return new Promise(
		(resolve, reject) => {

			function addNextScript() {
				if (scripts.length > 0) {
				var	e = cre('script', document.head);
					e.onload = addNextScript;
					e.src = dir + scripts.shift();
				} else {
					resolve(true);
				}
			}

		var	dir = lib.dir || ''
		,	scripts = lib.files || (lib.join ? lib : Array.from(arguments))
			;

			addNextScript();
		}
	);
}

async function loadLibOnDemand(libName) {
	if (!libName) {
		return false;
	}

var	lib = fileTypeLibs[libName] || {};
	if (!lib) {
		return false;
	}

var	varName = lib.varName || '';
	if (window[varName]) {
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
		for (var name of Array.from(depends)) if (name) {
			if (!(await loadLibOnDemand(name))) {
				return false;
			}
		}
	}

	return new Promise(
		(resolve, reject) => {

			function addNextScript(e) {

//* some var init, no better place for this:

				if (varName === 'zip' && window[varName]) {
					if (zip.useWebWorkers = !RUNNING_FROM_DISK) {

//* http://gildas-lormeau.github.io/zip.js/core-api.html#alternative-codecs
//* Either zip.workerScripts or zip.workerScriptsPath may be set, not both.

						if (USE_ZLIB_ASM) {
						var	zipWorkerScripts = [
								dir + 'z-worker.js',
								dir + zlibAsmSubDir + 'zlib.js',
								dir + 'zlib-asm/codecs.js',
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

				if (varName === 'PSD_JS' && !window[varName] && e) {
					window[varName] = require('psd');
				}

//* add scripts one by one:

				if (scripts.length > 0) {
				var	e = cre('script', document.head);
					e.setAttribute('data-lib-name', libName);
					e.onload = addNextScript;
					e.src = dir + scripts.shift();
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
							function(e) {
								return e.getAttribute('data-lib-name') === libName;
							}
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

/*function replaceJSONpartsFromPSD(key, value) {

	function JSONtoFlatLine(v) {
		return JSON.stringify(v, replaceJSONpartsFromPSD).replace(/"/g, "'");
	}

	var i;
	if (regJSONstringify.skipByKey.test(key)) {
		return '<skipped>';
	}
	if (regJSONstringify.skipByKeyIfLong.test(key)) {
		if (value && typeof value.length !== 'undefined' && value.length > 123) {
			return '<skipped [' + value.length + ' items]>';
		}
		if ((i = (''+value).length) > 456) {
			return '<skipped (' + i + ' chars)>';
		}
	}
	if (regJSONstringify.asFlatLine.test(key)) return JSONtoFlatLine(value);
	if (regJSONstringify.asFlatLines.test(key)) {
		if (typeof value === 'object') {
			if (value.map && value.length > 0) {
				return value.map(JSONtoFlatLine);
			} else {
				var o = {};
				for (i in value) o[i] = JSONtoFlatLine(value);
				return o;
			}
		}
		return JSONtoFlatLine(value);
	}
	return value;
}

function replaceJSONpartsFromTree(key, value) {
	if (
		typeof value === 'object'
	&&	typeof value.length === 'undefined'
	) {
	var	o = {};
		for (var i in value) {
			if (regJSONstringify.showFromTree.test(i)) o[i] = value[i];
		}
		return o || undefined;
	}
	return value;
}*/

function replaceJSONpartsFromNameToCache(key, value) {
	if (
		key === 'zoom'
	&&	value.substr
	) {
	var	z = orz(value);

		if (z <= 0 || z == 100) return;

	var	x = 100;

		while (z < x && x > 0) {
		var	d = Math.floor(x / 2);
			if (z >= d) break;
			x = d;
		}

		if (x <= 0 || x == 100) return;

		return ''+x+'%';
	}

	return value;
}

function clearFill(ctx) {
	ctx.fillStyle = 'white';
	ctx.fillRect(0,0, ctx.canvas.width, ctx.canvas.height);

	return ctx;
}

function clearCanvasBeforeGC(e) {
	if (e && isCanvasElement(e = e.canvas || e)) {
		e.width = 1;
		e.height = 1;

		return e;
	}
}

function isCanvasElement(e) {
	return (
		e
	&&	e.tagName
	&&	e.tagName.toLowerCase() === 'canvas'
	);
}

function isImgElement(e) {
	return (
		e
	&&	e.tagName
	&&	e.tagName.toLowerCase() === 'img'
	);
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
	if (isImgElement(img)) {
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

function getCanvasFromByteArray(bytes, w,h) {
var	canvas = cre('canvas')
,	ctx = canvas.getContext('2d')
	;

	canvas.width = w;
	canvas.height = h;

var	imageData = ctx.createImageData(w,h);
	imageData.data.set(bytes);	//* <- RGBA array

	ctx.putImageData(imageData, 0,0);

	return canvas;
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
,	maxScaleFactor = 4	//* <- one-step scaling result is too blocky, stepping by factor of 2 is too blurry, 4 looks okay
	;

	if (
		widthRatio  > maxScaleFactor
	||	heightRatio > maxScaleFactor
	) {

//* caclulate nearest scale factor top down:

		if (DOWNSCALE_BY_MAX_FACTOR_FIRST) {
			canvas.width  = widthTo  = Math.round(widthFrom  / maxScaleFactor);
			canvas.height = heightTo = Math.round(heightFrom / maxScaleFactor);
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
				widthToUp  *= maxScaleFactor;
				heightToUp *= maxScaleFactor;

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

function getFirstPixelImageData(img) {
var	canvas = cre('canvas')
,	ctx = canvas.getContext('2d')
,	w = canvas.width  = 1
,	h = canvas.height = 1
	;

	ctx.drawImage(img, 0,0);

	return ctx.getImageData(0,0, w,h);
}

function getFirstPixelRGBA(img) {
	return (
		isImgElement(img)
		? getFirstPixelImageData(img).data.slice(0,4)
		: (img.slice ? img.slice(0,4) : null)
	);
}

function getProjectContainer(e) {return getTargetParentByClass(e, regClassLoadedFile);}
function getProjectButton(e) {return getTargetParentByClass(e, regClassButton);}

function addButton(parent, text, func) {
var	e = cre('button', parent);
	e.textContent = text || e.tagName;
	if (func) e.setAttribute('onclick', func);
	return e;
}

function addOption(parent, text, value) {
var	e = cre('option', parent);
	e.value = (typeof value !== 'undefined' ? value : text) || '';
	e.textContent = text || '';
	return e;
}

function trimParam(v) {
	return v.replace(regLayerNameParamTrim, '');
}

function getOtherSwitchParamName(switchType, switchName) {
var	a = SWITCH_NAMES_BY_TYPE[switchType];
	return a[1 - a.indexOf(switchName)];
}

function getTruthyValue(v) {
	return !(
		!v
	||	!(v = ('' + v).toLowerCase())
	||	FALSY_STRINGS.indexOf(v) >= 0
	);
}

function getNormalizedOpacity(a) {
	return Math.max(0, Math.min(1, orz(a) / MAX_OPACITY));
}

function getNormalizedBlendMode(b) {
var	r,b = ('' + b).toLowerCase();

	return (
		BLEND_MODES_REMAP[b]
	||	BLEND_MODES_REMAP[
			r = trim(BLEND_MODES_REPLACE.reduce(
				(result, v,i,a) => result.replace(v[0], v[1] || '')
			,	b
			))
		]
	||	r
	||	b
	);
}

function getParentLayer(layer, propName, isTrue) {
	if (!layer) return null;

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

function getLayerPath(layer, includeSelf) {
	if (!layer) return [];

var	path = (includeSelf ? [layer.name] : []);

	while (layer = getParentLayer(layer)) {
		path.unshift(layer.name);
	}

	return path;
}

function getLayerPathText(layer) {
	return getLayerPath(layer, true).join(' / ');
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
	while (
		layers
	&&	layers.length
	&&	layers.length > 0
	) {
	var	layersToRender = layers.filter(isLayerRendered);

		if (layersToRender.length > 1) {
			return layersToRender;
		} else {
			layers = layersToRender[0];
		}
	}

	return layers;
}

function isLayerRendered(layer) {
	return !(
		layer.params.skip
	||	layer.params.skip_render
	||	(layer.clippingLayer && !isLayerRendered(layer.clippingLayer))
	);
}

function isLayerSkipped(layer) {
	return (
		layer.params.skip
	// ||	regLayerNameToSkip.test(layer.name)
	||	(layer.clippingLayer && isLayerSkipped(layer.clippingLayer))
	);
}

function getImgOptimized(img) {
	return img || new Promise(
		(resolve, reject) => {

//* TODO: get array of pixels without premultiplied alpha; decode PNG manually?

			function checkResult(canvas, img) {
			var	oldSrc = img.src
			,	newSrc = canvas.toDataURL()
			,	isOldBetter = (newSrc.length >= oldSrc.length)
			,	blob = dataToBlob(isOldBetter ? oldSrc : newSrc)
				;

				if (blob) newSrc = blob.url; else
				if (isOldBetter) newSrc = null;

				if (newSrc) {
					img.onload = () => resolve(img);
					img.src = newSrc;
				} else {
					resolve(img);
				}
			}

			if (
				isImgElement(img)
			&&	img.width > 0
			&&	img.height > 0
			) {
			var	canvas = cre('canvas')
			,	w = canvas.width  = img.width
			,	h = canvas.height = img.height
			,	ctx
				;

				if (ctx = canvas.getContext('2d')) {
					ctx.drawImage(img, 0,0);
					checkResult(canvas, img);
				} else {
					reject();
				}
			} else {
				resolve(img);
			}
		}
	);
}

async function getImgDataFromUrl(url) {
var	arrayBuffer = await readFilePromiseFromURL(url)
,	img  = UPNG.decode(arrayBuffer)
,	rgba = UPNG.toRGBA8(img)[0]	//* <- UPNG.toRGBA8 returns array of frames, size: width * height * 4 bytes.
	;

	return {
		width: img.width
	,	height: img.height
	,	data: rgba
	};
}

function thisToPng(targetLayer) {
	try {
	var	t = targetLayer || this
	,	e = t.sourceData || t
	,	i = e.prerendered || e.thumbnail
		;

		if (i) return i;

		if (isImgElement(e = e.image || e)) {
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
			console.log(error);
		}
	}

	return null;
}

//* Page-specific functions: internal, loading *-------------------------------

function isStopRequestedAnywhere() {
	return (
		isStopRequested
	||	Array.from(arguments).find(
			(o) => (
				typeof o === 'object'
			&&	o
			&&	o.isStopRequested
			)
		)
	);
}

async function removeProjectView(fileID) {
var	countDeleted = gi(fileID).reduce(
		(count, e) => {
			if (e.project) {
				e.project.isStopRequested = true;
			}
			if (del(e)) {
				++count;
			}
		}
	,	0
	);

	if (countDeleted) {
		logTime('"' + fileID + '" closed, ' + countDeleted + ' element(s) removed');
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
		var	fileID = 'loaded-file: ' + sourceFile.name
		,	childKeys = ['layers']
		,	keysToRemove = [
				'loading'
			,	'toPng'
			];

			if (!TESTING) {
				keysToRemove = keysToRemove.concat([
					'blendModeOriginal'
				,	'nameOriginal'
				,	'sourceData'
				,	'maskData'
				]);
			}
			cleanupObjectTree(project, childKeys, keysToRemove);

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

//* attach prepared branch to document:

			if (result) {
				removeProjectView(fileID);

				container.id = buttonTab.id = fileID;
				id('loaded-files-view').appendChild(container);

				buttonText.setAttribute('onclick', 'selectProject(this)');
				buttonThumb.setAttribute('onclick', 'selectProject(this)');

				buttonText.click();

				return true;
			}
		}

//* cleanup on errors or cancel:

	} catch (error) {
		console.log(error);
	}

	buttonTab.className = 'button loading failed';

	setTimeout(function() {
		del(buttonTab);
	}, 2000);

	return false;
}

async function getNormalizedProjectData(sourceFile, button) {

	async function tryFileParserFunc(f, project) {
		try {
			return await f(project);
		} catch (error) {
			console.log(error);
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

var	startTime = +new Date;

	try_loaders:
	for (var ftl of fileTypeLoaders) if (ftl.dropFileExts.indexOf(ext) >= 0)
	for (var f of ftl.handlerFuncs) {
	var	project = {
			fileName: fileName
		,	baseName: baseName
		,	loading: {
				startTime: +new Date
			,	data: sourceFile
			,	images: []
			}
		};

		if (await tryFileParserFunc(f, project)) {
			break try_loaders;
		} else {
			project = null;
		}

		if (isStopRequestedAnywhere(project, button)) {
			 break;
		}
	}

var	tookTime = +new Date - startTime;

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
		,	n = project.fileName
			;

			if (options) {
			var	l_a = project.loading.images
			,	l_i = project.loading.imagesCount = l_a.length
			,	actionLabel = 'preloading ' + l_i + ' images'
			,	result, layer
				;

				logTime('"' + n + '" started ' + actionLabel);

//* try loading one by one to avoid flood of errors:

			var	startTime = +new Date;

				while (
					l_a.length > 0
				&&	(layer = l_a.pop())
				&&	(result = !isStopRequestedAnywhere(project))
				&&	(result = await getLayerImgLoadPromise(layer))
				&&	(result = await getLayerMaskLoadPromise(layer))
				);

			var	tookTime = +new Date - startTime;

				logTime(
					'"' + n + '"'
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
				logTime('"' + n + '" has no options.');
			}
		} catch (error) {
			console.log(error);

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
			var	sectionName = ''+sectionName
			,	listName    = ''+listName
			,	o = (options || (options = {}))
			,	o = (o[sectionName] || (o[sectionName] = {}))
			,	optionGroup = (o[listName] || (o[listName] = {
					'params': {}
				,	'items': {}
				}))
				;

				return optionGroup;
			}

			function checkSwitchParams(globalOptionParams) {
				for (var switchType in SWITCH_NAMES_BY_TYPE)
				for (var switchName of SWITCH_NAMES_BY_TYPE[switchType]) if (params[switchName]) {
				var	o = (project.switchParamNames || (project.switchParamNames = {}))
				,	o = (o[switchType] || (o[switchType] = {}))
					;

					if (!o.implicit) {
						o.implicit = getOtherSwitchParamName(switchType, switchName);
						o.explicit = switchName;
					}

					globalOptionParams[switchName] = true;
				}
			}

			function addOptionGroup(sectionName, listName) {
			var	optionGroup = getOptionGroup(sectionName, listName)
			,	optionParams = optionGroup.params
			,	i,j,k,o
				;

				checkSwitchParams(optionParams);

				if (j = params[k = 'multi_select']) {
					if (o = optionParams[k]) {
						if (o.min > j.min) o.min = j.min;
						if (o.max < j.max) o.max = j.max;
					} else {
						o = optionParams[k] = {};
						for (i in j) o[i] = j[i];
					}
				}

				for (k of [
					'last',
					'no_prefix',
				]) {
					if (params[k]) optionParams[k] = true;
				}

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
			,	optionItemLayers = (optionItems[optionName] || (optionItems[optionName] = []))
				;

				if (optionName !== '') {
					for (k of [
						'preselect',
					]) {
						if (params[k]) optionParams[k] = optionName;
					}

					optionItemLayers.push(layer);
				}
			}

			function addOptionsFromParam(sectionName, listName) {
			var	param = params[sectionName];
				if (!param) return;

			var	optionGroup = addOptionGroup(sectionName, listName || sectionName)
			,	optionParams = optionGroup.params
			,	optionItems = optionGroup.items
			,	i,j,k = sectionName
				;

				checkSwitchParams(optionParams);

				if (sectionName === 'separate') {
					optionItems[k] = k;
				} else
				if (sectionName === 'side') {
					for (k in (j = la.project_option_side)) {
						optionItems[k] = j[k];
					}

					j = VIEW_SIDES.indexOf(param);

					if (j >= 0) {
						params[sectionName] = (
							params.not
							? VIEW_SIDES[j ? 0 : 1]
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
						param.forEach(v => {
						var	j = v.threshold
						,	k = (
								(
									typeof v.x !== 'undefined'
									? [v.x, v.y]
									: [v.radius]
								).map(x => (
									typeof x.in !== 'undefined'
									? x.in + ':' + x.out
									: x.out
								)).join('x')
							+	'px'
							+	(j?'-'+j:'')
							);

							optionItems[k] = v;
						});
					}
					layer.isMaskGenerated = true;
				} else {
					if ((i = 'format') in param) {
						optionParams[i] = param[i];
					}
					if ((i = 'values') in param) {
						param[i].forEach(v => {
						var	k = v + '%';	//* <- pad bare numbers to avoid autosorting in <select>
							if (sectionName == 'opacities') v = (orz(v) / 100);
							optionItems[k] = v;
						});
					}
				}
			}

		var	params = layer.params
		,	n = layer.name
		,	m = layer.names = (
				n
				.split(regSplitLayerNames)
				.map(trim)
				.filter(arrayFilterNonEmptyValues)
				.filter(arrayFilterUniqueValues)
			);

			if (isLayerSkipped(layer)) {
				return;
			}

			if (!m.length || params.none) {
				m.push('');
			}

		var	layersInside = layer.layers
		,	j = 'layersForCopyPaste'
		,	k = 'copypaste'
		,	layerCP = params[k]
			;

			if (layerCP) {
			var	allCP = project[j] || (project[j] = {});

				for (var t in layerCP) {
				var	allAliases = allCP[t] || (allCP[t] = {});

					layerCP[t].forEach(
						alias => {
						var	allByAlias = allAliases[alias] || (allAliases[alias] = []);

							allByAlias.push(layer);
						}
					);
				}
			}

			addOptionsFromParam('zoom');
			addOptionsFromParam('side');
			addOptionsFromParam('separate');

			m.forEach(
				listName => {
					addOptionsFromParam('opacities', listName);
					addOptionsFromParam('paddings', listName);
				}
			);

			if (layer.isOptionList) {
				m.forEach(
					listName => addOptionGroup(layer.type, listName)
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
						listName => m.forEach(
							optionName => addOptionItem(layer, parent.type, listName, optionName)
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
		var	i = layers.length
		,	layer, clippingLayer
			;

			while (i--) if (layer = layers[i]) {
				if (clippingLayer && layer.isClipped) {
					layer.clippingLayer = clippingLayer;
				} else {
					clippingLayer = layer;
				}
			}

			return (
				layers
				.filter(layer => {
					if (isLayerSkipped(layer)) {
						return false;
					} else {
						if (isInsideColorList) {
							layer.isInsideColorList = true;
						}
						return true;
					}
				})
				.map(getProcessedLayerInBranch)
			);
		}

	var	options;

		project.layers = getUnskippedProcessedLayers(project.layers);

		for (var switchType in SWITCH_NAMES_BY_TYPE) {
		var	o = (project.switchParamNames || (project.switchParamNames = {}))
		,	o = (o[switchType] || (o[switchType] = {}))
			;

			if (!o.implicit) {
			var	switchNames = SWITCH_NAMES_BY_TYPE[switchType];
				o.implicit = switchNames[0];
				o.explicit = switchNames[1];
			}
		}

		return options;
	}

	function getLayerImgLoadPromise(layer) {
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
					if (TESTING) console.log(
						'got color code in param: '
					+	getColorTextFromArray(colorCode)
					+	', layer content not checked at: '
					+	getLayerPathText(layer)
					);

					layer.img = colorCode;

					resolve(true);
					return;
				}

			var	img = null;

				try {
					img = project.toPng(layer);
				} catch (error) {
					console.log(error);
				}

				if (
					img
				&&	isImgElement(img)
				) {
				var	onImgLoad = async function(e) {
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
						var	i = layer.img = await getImgOptimized(img);
							i.top  = layer.top;
							i.left = layer.left;
						}

						resolve(true);
					};

					if (!img.complete) {
						img.onload = onImgLoad;
					} else {
						onImgLoad();
					}
				} else
				if (colorCode) {
					console.log(
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

	function getLayerMaskLoadPromise(layer) {
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
				,	data = canvas.toDataURL()
				,	blob = dataToBlob(data)
				,	img = layer.mask = cre('img')
					;

					img.top = mask.top;
					img.left = mask.left;
					img.defaultColor = orz(mask.defaultColor);
					img.onload = () => resolve(true);
					img.src = (blob ? blob.url : data);
				} else {
					resolve(true);
				}
			}
		);
	}

	function createOptionsMenu(project, container) {

		function addHeader(text) {
		var	th = cre('header', cre('th', cre('tr', table)));
			th.textContent = text + ':';
		}

		function addOptions(sectionName, text) {

//* section = type of use (fill colors, draw parts, etc):

		var	section = options[sectionName]
		,	optionList
			;

//* list box = set of parts:

			for (var listName in section) if (optionList = section[listName]) {
			var	listLabel = text || listName
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

			var	s = cre('select', cre('td', tr));
				s.name = listName;
				s.setAttribute('data-section', sectionName);

				for (var switchType in SWITCH_NAMES_BY_TYPE) {
				var	b = getPropByNameChain(project, 'switchParamNames', switchType, 'implicit')
				,	c = getPropByNameChain(project, 'switchParamNames', switchType, 'explicit')
				,	la_switches = la.project_option_switches[switchType]
				,	td = cre('td', tr)
				,	label = cre('label', td)
				,	i = cre('input', label)
					;

					params[c] = !(params[b] = (typeof params[c] === 'undefined'));

					i.type = 'checkbox';
					i.className = switchType + '-checkbox';
					i.setAttribute('data-switch-type', switchType);
					i.checked = i.initialValue = !params[SWITCH_NAMES_BY_TYPE[switchType][0]];
					i.params = params;

					for (var i in la_switches) {
					var	j = la_switches[i]
					,	t = cre('span', label)
						;

						t.className = switchType + '-' + i;
						t.title = j.label + ': \r\n' + j.hint;
					}
				}

//* list item = each part:

				for (var optionName in items) {
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
						project.layersTopSeparated.forEach(
							(layer, layerIndex) => {
								addOption(s, (layerIndex + 1) + ': ' + layer.name);
							}
						);
					} else
					if (sectionName === 'zoom') {
						if (
							orz(optionName) == 100
						||	orz(optionName) <= 0
						) {
							if (addedDefaultZoom) {
								continue;
							}

						var	addedDefaultZoom = true;
							addEmpty = false;

							addOption(s, '100%');

							continue;
						}

						addOption(s, optionName);
					} else {
					var	optionLabel = optionName
					,	optionValue = optionName
						;

						if (sectionName === 'side') {
							optionLabel = view_sides[optionName] || optionName;
						}

						addOption(s, optionLabel, optionValue);
					}
				}

				if (addEmpty) {
					addOption(s, '', isZeroSameAsEmpty ? '0%' : '');
				}

				if (i = getPropByNameChain(project, 'options', sectionName, listName, 'params', 'preselect')) {
					s.initialValue = selectValue(s, i);
				} else {
					s.initialValue = selectValueByPos(s, params.last ? 'bottom' : 'top');
				}

			var	tabCount = gt('td', tr).length;
				if (maxTabCount < tabCount) maxTabCount = tabCount;
			}
		}

	var	options = project.options
	,	view_sides = la.project_option_side
	,	sectionBatches = la.project_option_sections
	,	sections
	,	table = cre('table', container)
	,	maxTabCount = 0
		;

		for (var i in sectionBatches) if (sections = sectionBatches[i]) {
			if (sections.header) {
			var	header = sections.header
			,	sections = sections.select
				;

				for (var sectionName in sections) {
					if (options[sectionName]) {
						if (header) {
							addHeader(header);
							header = null;
						}
						addOptions(sectionName, sections[sectionName]);
					}
				}
			} else {
				for (var sectionName in sections) {
					if (options[sectionName]) {
						addHeader(sections[sectionName]);
						addOptions(sectionName);
					}
				}
			}
		}

		gt('th', table).forEach(
			th => {
				th.colSpan = maxTabCount;
			}
		);
	}

	return await getProjectOptionsContainer(project);
}

function createProjectView(project) {
var	sourceFile = project.loading.data.file || {}
,	sourceFileTime = sourceFile.lastModified || sourceFile.lastModifiedDate
,	container = cre('div')
,	header = cre('header', container)
	;

	header.className = 'project-header';

//* show overall project info:

var	e = cre('section', header)
,	h = cre('header', e)
	;

	h.className = 'filename';
	h.textContent = project.fileName;

	if (project.channels && project.bitDepth) {
		t = project.channels + 'x' + project.bitDepth + ' ' + la.project.bits;
	} else
	if (project.channels) {
		t = project.channels + ' ' + la.project.channels;
	} else
	if (project.bitDepth) {
		t = project.bitDepth + ' ' + la.project.bits;
	} else t = '';

var	i = (
		project.width + 'x'
	+	project.height + ' '
	+	la.project.pixels
	)
,	j = arrayFilteredJoin([project.colorMode, t], ' ')
,	j = arrayFilteredJoin([i, j], ', ')
,	t = [j]
,	i = project.loading.imagesCount
,	j = project.layersCount
	;

	if (j) t.push(j + ' ' + la.project.layers);
	if (i) t.push(i + ' ' + la.project.images);

	if (sourceFile.size) t.push(sourceFile.size + ' ' + la.project.bytes);
	if (sourceFileTime)  t.push(la.project.date + ' ' + getFormattedTime(sourceFileTime));

	cre('div', e).innerHTML = arrayFilteredJoin(t, '<br>');

	t = 'console_log';
	addButton(cre('footer', e), la.hint[t]).name = t;

	container.addEventListener('click', onProjectButtonClick, false);

//* add batch controls:

	if (project.options) {
		for (var i in (t = la.project_controls)) {
		var	j = t[i]
		,	b = j.buttons
		,	e = cre('section', header)
		,	h = cre('header', e)
		,	f = cre('footer', e)
			;

			h.textContent = j.header + ':';

			for (var k in b) addButton(f, b[k]).name = k;
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
	if (fullImage && project && project.thumbnail) {

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

	var	e = createProjectView(project)
	,	h = gt('header', e)[0]
	,	f = gt('footer', e)[0]
	,	t = (
			f
			? cre('header', f, f.firstElementChild)
			: h || cre('header', e)
		)
	,	d = cre('div', e)
		;

		t.textContent = la.error.options;
		d.className = 'preview';
		d.appendChild(img);

		return e;
	}

	return null;
}

function isParamInLayerName(name) {
	while (
		name
	&&	name.length > 0
	) {
	var	i = name.indexOf('[');
		if (i < 0) return false;	//* <- has no "[param]", nothing else to see

	var	j = name.indexOf('(');
		if (j < 0) return true;		//* <- has "[param]" and no "(comment)"
		if (i < j) return true;		//* <- has "[param]" before "(comment)"

	var	k = name.indexOf(')', j)
		if (k < 0) return false;	//* <- the rest is unclosed "(comment"

		name = name.substr(k + 1);	//* <- continue looking after "(comment)"
	}

	return false;
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

var	m,k,v
,	paramList = []
,	params = {}
	;

	if (typeof layer.sourceData   === 'undefined') layer.sourceData   = sourceData;
	if (typeof layer.nameOriginal === 'undefined') layer.nameOriginal = name;

	name = name.replace(regTrimCommaSpace, '');

var	checkVirtualPath = (
		isInsideVirtualPath
	||	isParamInLayerName(name)
	);

//* common fixes:

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

	while (m = name.match(regLayerNameParamOrComment)) if (
		checkVirtualPath
	&&	(v = m[2])
	&&	(v === '/')
	) {
	var	subLayer = layer
	,	isSubLayerFolder = isLayerFolder
		;

		isLayerFolder = true;
		name          = m[1].replace(regTrimCommaSpace, '');
		subLayer.name = m[4].replace(regTrimCommaSpace, '');
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

		if (
			(v = m[3])
		&&	(v.length > 0)
		) {
			v
			.split(regLayerNameParamSplit)
			.map(trimParam)
			.filter(arrayFilterNonEmptyValues)
			.forEach(v => paramList.push(v.toLowerCase()));
		}

		name = (
			(m[1] + ', ' + m[4])
			.replace(regTrimCommaSpace, '')
		);
	}

//* process params:

	if (paramList.length > 0) {
		paramList = paramList.filter(arrayFilterUniqueValues);

		for (var param of paramList) {
			for (var k in regLayerNameParamType) if (m = param.match(regLayerNameParamType[k])) {

				if (NAME_PARTS_FOLDERS.indexOf(k) >= 0) {
					layer.type = k;
					layer.isVisibilityOptional = true;
				} else
				if (k === 'zoom' || k === 'opacities') {
					params[k] = {
						'values': getUniqueNumbersArray(m[1])
					,	'format': orz(m[2])
					};
				} else
				if (k === 'radius') {
					layer.isVisibilityOptional = true;
					v = (
						m[1]
						.split('/')
						.filter(v => regHasDigit.test(v))
						.map(
							x => {
								x = x.split('x', 2).map(
									y => {
										if (y.length == 0) return null;

										y = y.split(':', 2).map(
											z => orzFloat(
												z.replace(regTrimNaNorSign, '')
											)
										);

										if (y.length == 0) return {'out': 1};
										if (y.length == 1) return {'out': y[0]};

										return {
											'in': Math.min(...y)
										,	'out': Math.max(...y)
										};
									}
								);

								if (x.length == 0) return {'radius': 1};
								if (x.length == 1) return {'radius': x[0]};
								if (x[0] === null) x[0] = x[1];
								if (x[1] === null) x[1] = x[0];
								if (x[1] === null) x[1] = x[0] = 1;

								return {
									'x': x[0]
								,	'y': x[1]
								};
							}
						).map(
							v => {
								v.threshold = m[2];
								return v;
							}
						)
					);

					params[k] = v.concat(params[k] || []);
				} else
				if (k === 'copypaste') {
				var	j = m[1]
				,	v = m[2]
				,	o = params[k] || (params[k] = {})
				,	a = o[j] || (o[j] = [])
					;

					if (a.indexOf(v) < 0) {
						a.push(v);
					}
				} else
				if (k === 'color_code') {
					v = [0,0,0,255];

//* RGB(A):

					if (m[1]) {
						getNumbersArray(m[1], 4).forEach(
							(n,i) => (v[i] = n)
						);
					} else

//* hex:

					if (m[2]) {
						hex2rgbArray(m[2]).forEach(
							(n,i) => (v[i] = n)
						);
					}

					params[k] = v;
				} else
				if (k === 'multi_select') {
					v = (
						m[1] === 'optional'
						? [0,1]
						: getNumbersArray(m[2], 2)
					);

					params[k] = {
						'min': Math.max(0, v[0])
					,	'max': Math.max(1, v[v.length > 1?1:0])
					};
				} else
				if (k === 'check_order') {
					params[k] = m[1];
				} else
				if (k === 'preselect') {
					v = 'last';
					params[param.indexOf(v) >= 0 ? v : k] = true;
				} else
				if (k === 'batch') {
					params[param === k ? k : 'single'] = true;
				} else
				if (k === 'layout') {
					params[param === 'rows' || param === 'newline' ? 'newline' : 'inline'] = true;
				} else {
					if (k === 'side') {
						layer.isVisibilityOptional = true;
						if (
							(v = m[2])
						&&	(v = v[0])
						) {
							if (v === 'h') layer.flipSide = orz(layer.flipSide) | FLAG_FLIP_HORIZONTAL;
							if (v === 'v') layer.flipSide = orz(layer.flipSide) | FLAG_FLIP_VERTICAL;
						}
					}
					params[k] = param || k;
				}

				break;
			}
		}

		if (k = layer.type) {
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
					if (NAME_PARTS_FOLDERS.indexOf(k) >= 0) {
						layer.isOptionList = true;

						if (k === 'colors') {
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

	layer.name = name;
	layer.params = params;
	layer.parent = parentGroup;
	parentGroup.push(layer);

	if (
		!params[k = 'check_order']
	&&	(v = getPropByNameChain(getParentLayer(layer), 'params', k))
	) {
		params[k] = v;
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
	for (var v of layers) {

		if (isStopRequestedAnywhere(project)) {
			return false;
		}

		await callback(v, parentGroup);
	}

	return true;
}

//* Page-specific functions: internal, loading from file *---------------------

async function loadCommonWrapper(project, libName, fileParserFunc, treeConstructorFunc) {
	if (!(await loadLibOnDemand(libName))) {
		return;
	}

var	actionLabel = 'opening with ' + libName;

	logTime('"' + project.fileName + '" started ' + actionLabel);

	project.loading.startParsingTime = +new Date;

	try {
	var	d = project.loading.data
	,	sourceData = await fileParserFunc(
			d.url
			? (d.file = await readFilePromiseFromURL(d.url, 'blob'))
			: d.file
		);
	} catch (error) {
		console.log(error);
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
	+	(+new Date - project.loading.startParsingTime)
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

		var	l_i = project.layersCount = (
				(sourceData.layersCount || 0)
			+	(sourceData.stacksCount || 0)
			);

			if (!l_i) return;

			project.width	= sourceData.width;
			project.height	= sourceData.height;

//* gather layers into a tree object:

			async function addLayerToTree(layer, parentGroup) {
			var	n	= layer.name || ''
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
				||	getTruthyValue(layer.clipping)
				)
			,	isVisible = (
					typeof layer.visibility === 'undefined'
				||	layer.visibility === 'visible'
				||	layer.visibility !== 'hidden'
				// ||	getTruthyValue(layer.visibility)	//* <- non-standard, for testing
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

//* note: layer masks also may be emulated via compositing modes in ORA

				if (mask) {
				var	m = layerWIP.mask = getPropByAnyOfNamesChain(mask, 'img', 'image');	//* <- already loaded img element
					m.top    = orz(mask.top  || mask.y);
					m.left   = orz(mask.left || mask.x);
					m.width  = orz(m.width   || mask.width);
					m.height = orz(m.height  || mask.height);
				}

				parentGroup = await getNextParentAfterAddingLayerToTree(
					layerWIP
				,	layer
				,	n
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

		var	l_i = project.layersCount = sourceData.layers.length;

			if (!l_i) return;

		var	projectHeader = sourceData.header || sourceData
		,	layerMasks = getPropByNameChain(sourceData, 'layerMask', 'obj', 'layers')
		,	m = projectHeader.mode
			;

			project.width	= projectHeader.cols;
			project.height	= projectHeader.rows;
			project.colorMode	= (isNaN(m) ? m : PSD_COLOR_MODES[m]);
			project.channels	= projectHeader.channels;
			project.bitDepth	= projectHeader.depth;

//* gather layers into a tree object:

			async function addLayerToTree(layer, parentGroup) {
			var	l	= layer.layer || layer
			,	n	= layer.name  || l.name  || ''
			,	img	= layer.image || l.image || null
			,	mask	= layer.mask  || l.mask  || img.mask || null
			,	mode	= getPropByAnyOfNamesChain(l, 'blendMode', 'mode')
			,	clipping = getPropByAnyOfNamesChain(l, 'blendMode', 'clipped', 'clipping')
			,	modePass = getPropByNameChain(l, 'adjustments', 'sectionDivider', 'obj', 'blendMode')

//* "fill" opacity is used by SAI2 instead of usual one for layers with certain blending modes when exporting to PSD.
//* source: https://github.com/meltingice/psd.js/issues/153#issuecomment-436456896

			,	fillOpacity = (
					l.fillOpacity
					? getNormalizedOpacity(l.fillOpacity().layer.adjustments.fillOpacity.obj.value)
					: 1
				)
			,	layers = (
					layer.hasChildren()
					? layer.children()
					: null
				)
			,	blendMode = getNormalizedBlendMode(mode)
			,	isLayerFolder = (layers && layers.length > 0)
			,	isPassThrough = (
					regLayerBlendModePass.test(modePass)
				||	regLayerBlendModePass.test(blendMode)
				)
			,	layerWIP = {
					top:    orz(l.top)
				,	left:   orz(l.left)
				,	width:  orz(l.width)
				,	height: orz(l.height)
				,	opacity: getNormalizedOpacity(l.opacity) * fillOpacity
				,	isVisible: getTruthyValue(l.visible)
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
				,	n
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
			,	sourceData.tree().children()
			,	addLayerToTree
			);
		}
	);
}

async function loadPSDLIB(project) {
	return await loadCommonWrapper(
		project
	,	'PSDLIB.js'
	,	async function fileParserFunc(file) {
			return PSDLIB.parse(await readFilePromise(file));
		}
	,	async function treeConstructorFunc(project, sourceData) {
			if (!sourceData.layers) return;

		var	l_a = sourceData.layers
		,	l_i = project.layersCount = l_a.length
			;

			if (!l_i) return;

			project.width	= sourceData.width;
			project.height	= sourceData.height;
			project.colorMode	= sourceData.colormode;
			project.channels	= sourceData.channels;
			project.bitDepth	= sourceData.depth;

//* gather layers into a tree object:

		var	parentGroup = project.layers = []
		,	layer
		,	d,k,n,t
			;

			while (l_i--) if (layer = l_a[l_i]) {
				if (isStopRequestedAnywhere(project)) {
					return;
				}
				n = layer.name || '';
				if (regPSD.layerNameEndOfFolder.test(n)) {
					while (
						(parentGroup = parentGroup.parent || project.layers)
					&&	typeof parentGroup.length === 'undefined'
					);

					continue;
				} else {
				var	isLayerFolder = false
				,	ali = layer.additionalLayerInfo || []
					;

					if (ali) {
					var	a_i = ali.length;
						while (a_i--) if (
							(t = ali[a_i])
						&&	(d = t.data)
						) {
							if (
								(k = t.name)
							&&	regPSD.layerUnicodeName.test(k)
							) {
								n = d;
							} else if (
								(k = d.type)
							&&	regPSD.layerTypeFolder.test(k)
							) {
								isLayerFolder = true;
							}
						}
					}

//* not supported here: layer masks, visibility toggle

				var	mode = layer.blendMode || ''
				,	blendMode = getNormalizedBlendMode(mode)
				,	layerWIP = {
						top:    orz(layer.top)
					,	left:   orz(layer.left)
					,	width:  orz(layer.width)
					,	height: orz(layer.height)
					,	opacity: getNormalizedOpacity(layer.opacity)
					,	isVisible: true
					,	isClipped: getTruthyValue(layer.clipping)
					,	isPassThrough: regLayerBlendModePass.test(blendMode)
					,	blendMode: blendMode
					,	blendModeOriginal: mode
					};

					parentGroup = await getNextParentAfterAddingLayerToTree(
						layerWIP
					,	layer
					,	n
					,	parentGroup
					,	isLayerFolder
					);
				}
			}

			return !isStopRequestedAnywhere(project);
		}
	);
}

//* Page-specific functions: internal, rendering *-----------------------------

function isOptionRelevant(project, values, sectionName, listName, optionName) {
var	o = getProjectOptionValue(project, sectionName, listName, optionName);

	if (
		o
	&&	o.map
	&&	o.length > 0
	) {
	var	section = values[sectionName]
	,	oldOptionName = section[listName]
	,	optionNameChanged = (oldOptionName !== optionName)
	,	result = false
		;

		if (optionNameChanged) {
			section[listName] = optionName;
		}

		for (var layer of o) {
			if (getLayerPathVisibilityByValues(project, layer, values, listName)) {
				result = true;
				break;
			}
		}

		if (optionNameChanged) {
			section[listName] = oldOptionName;
		}

		return result;
	} else {
		return true;
	}

	return false;
}

function isSetOfValuesOK(project, values) {
var	section, optionName;

	for (var sectionName in values) if (section = values[sectionName])
	for (var listName in section) if (optionName = section[listName]) {
		if (!isOptionRelevant(project, values, sectionName, listName, optionName)) {
			return false;
		}
	}

	return true;
}

function getSetOfRelevantValues(project, values) {
var	section, optionName, o, resultSet;

	for (var sectionName in values) if (section = values[sectionName])
	for (var listName in section) if (optionName = section[listName]) {
		o = resultSet || (resultSet = {});
		o = o[sectionName] || (o[sectionName] = {});
		o[listName] = (
			isOptionRelevant(project, values, sectionName, listName, optionName)
			? optionName
			: ''
		);
	}

	return resultSet;
}

function selectValueByPos(s, valuePos) {
var	v = s.value;

	if (valuePos === 'top') {
		v = s.options[0].value;
	} else
	if (valuePos === 'bottom') {
		v = s.options[s.options.length - 1].value;
	} else
	if (valuePos === 'init') {
		v = s.initialValue;
	} else {
		for (var o of s.options) if (
			'' === o.value
		||	'' === trim(o.textContent)
		) {
			v = o.value;
			break;
		}
	}

	return selectValue(s, v);
}

function selectValue(s, valueContent) {
	s.value = valueContent || '';

//* Set attribute for CSS:

	s.setAttribute(
		'value'
	,	(
			ZERO_PERCENT_EQUALS_EMPTY
		&&	NAME_PARTS_PERCENTAGES.indexOf(s.getAttribute('data-section')) >= 0
		&&	s.value === '0%'
			? ''
			: s.value
		)
	);

	return s.value;
}

function setAllValues(project, valuePos) {
	gt('select', project.container).forEach(
		s => selectValueByPos(s, valuePos)
	);

	if (
		valuePos === 'init'
	||	valuePos === 'empty'
	) {
		gt('input', project.container).forEach(
			i => {
				i.checked = (
					valuePos === 'init'
					? i.initialValue
					: true
				);

				updateCheckBox(i);
			}
		);
	}

	updateBatchCount(project);
	showImg(project);
}

function getAllMenuValues(project, checkSelectedValue) {
var	values = {};

	gt('select', project.container).forEach(
		s => {
		var	sectionName = s.getAttribute('data-section')
		,	listName    = s.name
		,	optionLists = (values[sectionName] || (values[sectionName] = {}))
			;

			optionLists[listName] = (
				(
					checkSelectedValue
				&&	getPropByNameChain(project, 'options', sectionName, listName, 'params', 'single')
				)
				? [s.value]
				: gt('option', s).map(o => o.value)
			);
		}
	);

	return values;
}

function getAllValueSets(project, checkSelectedValue, onlyNames, stopAtMaxCount) {

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

			for (var optionName of optionNames) {
				if (
					onlyNames
				&&	stopAtMaxCount
				&&	resultSets.length > MAX_BATCH_PRECOUNT
				) {
					return;
				}

//* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#Deep_Clone

			var	values = JSON.parse(JSON.stringify(partialValueSet || {}))
			,	section = (values[sectionName] || (values[sectionName] = {}))
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

					if (onlyNames) {
						if (resultSets.indexOf(fileName) < 0) {
							resultSets.push(fileName);
						}
					} else {
						if (!(fileName in resultSets)) {
							resultSets[fileName] = values;
						}
					}
				}
			}
		}
	}

var	values = getAllMenuValues(project, checkSelectedValue)
,	resultSets = onlyNames ? [] : {}
,	optionLists = []
,	section
,	sectionName
,	optionNames
,	listName
,	maxPossibleCount = 1
	;

	for (var sectionName in values) if (section = values[sectionName])
	for (var listName in section) if (optionNames = section[listName]) {
		optionLists.push({
			'sectionName': sectionName
		,	'listName'   : listName
		,	'optionNames': optionNames
		});
		if (onlyNames) {
			maxPossibleCount *= optionNames.length;
		}
	}

	if (
		onlyNames
	&&	stopAtMaxCount
	&&	maxPossibleCount > MAX_BATCH_PRECOUNT
	) {
		return null;
	}

	goDeeper(optionLists);

	return resultSets;
}

function getAllValueSetsCount(project) {
var	a = getAllValueSets(
		project
	,	true
	,	true
	,	MAX_BATCH_PRECOUNT && MAX_BATCH_PRECOUNT > 0
	);

	return (
		a === null
		? la.hint.too_much
		: a.length
	);
}

function getUpdatedMenuValues(project, updatedValues) {
var	values = {};

	gt('select', project.container).forEach(
		s => {

//* 1) check current selected values:

		var	sectionName   = s.getAttribute('data-section')
		,	listName      = s.name
		,	selectedValue = s.value || ''
		,	hide = false
			;

//* 2) hide irrelevant options:

			if (updatedValues && updatedValues !== true) {
			var	fallbackValue = ''
			,	selectedValueHidden = false
			,	allHidden = true
				;

				gt('option', s).forEach(
					o => {
					var	optionName = o.value || ''
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
						if (!o.hidden === hide) {
							o.hidden = o.disabled = hide;
						}
					}
				);

			var	hide = (allHidden ? 'none' : '')
			,	container = getThisOrParentByClass(s, 'project-option') || s.parentNode
			,	style = container.style
				;

				selectValue(s, (
					!hide && selectedValueHidden
					? fallbackValue
					: selectedValue
				));
				if (style.display != hide) {
					style.display = hide;
				}
			}

//* 3) get new values after update:

		var	section = (values[sectionName] || (values[sectionName] = {}));
			section[listName] = (
				!hide
			&&	trim(listName = s.name).length > 0
			&&	trim(selectedValue = s.value).length > 0
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
		||	typeof img === 'string'
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

			var	logLabelWrap = blendMode + ': ' + project.rendering.nestedLayers.map(v => v.name).join(' / ');
				console.time(logLabelWrap);
				console.group(logLabelWrap);

			var	logLabel = blendMode + ': loading image data';
				console.time(logLabel);
			}

//* get pixels of layer below (B):

			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = BLEND_MODE_NORMAL;

			if (TESTING_RENDER) {
			var	t = 'tryBlendingEmulation: ' + blendMode + ', layer ';
				addDebugImage(project, canvas, t + 'below at ' + (ctx.globalAlpha * 100) + '%', 'yellow');
			}

		var	oldData = ctx.getImageData(0,0, w,h)
		,	b = oldData.data
			;

//* get pixels of layer above (A):

			ctx.clearRect(0,0, w,h);
			ctx.globalAlpha = (isTransition ? 1 : opacity);

			drawImageOrColorInside(img);

			if (TESTING_RENDER) addDebugImage(project, canvas, t + 'above at ' + (ctx.globalAlpha * 100) + '%', 'orange');

			ctx.globalAlpha = 1;

		var	newData = ctx.getImageData(0,0, w,h)
		,	a = newData.data
			;

//* get pixels of transition mask (M):

			if (isTransition) {
				ctx.clearRect(0,0, w,h);
				ctx.globalAlpha = opacity;

				drawImageOrColorInside(mask || 'white');

				if (TESTING_RENDER) addDebugImage(project, canvas, t + 'mask at ' + (ctx.globalAlpha * 100) + '%', 'brown');

				ctx.globalAlpha = 1;

			var	maskData = ctx.getImageData(0,0, w,h)
			,	m = maskData.data
				;
			}

//* compute resulting pixels linearly into newData, and save result back onto canvas:

			if (TESTING_RENDER) {
				console.timeEnd(logLabel);
				logLabel = blendMode + ': running calculation';
				console.time(logLabel);
			}

		var	isDone = callback(a,b,m);

			if (TESTING_RENDER) {
				console.timeEnd(logLabel);
				logLabel = blendMode + ': saving result to canvas';
				console.time(logLabel);
			}

			ctx.putImageData(isDone ? newData : oldData, 0,0);

			if (TESTING_RENDER) {
				console.timeEnd(logLabel);
				console.groupEnd(logLabelWrap);
				console.timeEnd(logLabelWrap);
			}

			return isDone;
		}

		function usingAsmJS(a,b,m) {
			try {
			var	i = a.length
			,	uint8array = getOrCreateReusableHeap(project)
			,	env = null
			,	heap = uint8array.buffer
			,	compute = CompositionModule(window, env, heap)
				;

				uint8array.set(b, 0);
				uint8array.set(a, i);

				if (m) uint8array.set(m, i + i);

				compute[funcName](i);
				a.set(uint8array.slice(0, i));

				return true;

			} catch (error) {
				console.log(error);
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

	if (!ctx || !img) return;

	if (typeof opacity === 'undefined') opacity = 1;
	if (typeof blendMode === 'undefined') blendMode = BLEND_MODE_NORMAL;

var	canvas = ctx.canvas;

	if (canvas && opacity > 0) {
		ctx.globalCompositeOperation = blendMode;

	var	x = orz(img.left)
	,	y = orz(img.top)
	,	w = canvas.width
	,	h = canvas.height
	,	m = ctx.globalCompositeOperation
	,	isTransition = !!(mask || blendMode === BLEND_MODE_TRANSIT)
		;

//* use native JS blending if available, or emulation fails/unavailable:

		if (
			m === blendMode
		||	!tryBlendingEmulation(blendMode)
		) {
			if (TESTING && m !== blendMode) console.log(['blendMode =', blendMode, 'fallback =', m]);

			ctx.globalAlpha = opacity;

			drawImageOrColorInside(img);
		}

		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = BLEND_MODE_NORMAL;
	}

	return canvas;
}

function padCanvas(ctx, padding) {

	function addPadding(res, ref, radius) {
	var	referencePixels = ref.data
	,	resultPixels = res.data
	,	resultValue, distMin
	,	startValue = (t_min ? 255 : 0)
	,	radius = Math.abs(radius)
	,	radiusPixels = Math.ceil(radius)
		;

		for (var y = h; y--;) next_result_pixel:
		for (var x = w; x--;) {
		var	pos = getAlphaDataIndex(x,y,w);

			if (t_dist) {
				distMin = +Infinity;
			} else {
				resultValue = startValue;
			}

			look_around:
			for (var ydy, dy = -radiusPixels; dy <= radiusPixels; dy++) if ((ydy = y + dy) >= 0 && ydy < h)
			for (var xdx, dx = -radiusPixels; dx <= radiusPixels; dx++) if ((xdx = x + dx) >= 0 && xdx < w) {
			var	alpha = referencePixels[getAlphaDataIndex(xdx, ydy, w)];

				if (t_min) {
					if (resultValue > alpha) resultValue = alpha;
					if (resultValue == 0) break look_around;
				} else
				if (t_max) {
					if (resultValue < alpha) resultValue = alpha;
					if (resultValue == 255) break look_around;
				} else
				if (alpha > threshold) {
				var	d = dist(dx, dy) + 1 - alpha/255;
					if (d > radius) {
						if (distMin > d) distMin = d;
					} else {
						resultPixels[pos] = 255;
						continue next_result_pixel;
					}
				}
			}

			if (t_dist) {
			var	distFloor = Math.floor(distMin);
				resultPixels[pos] = (
					distFloor > radius
					? 0
					: (255 * (1 + distFloor - distMin))
				);
			} else {
				resultPixels[pos] = resultValue;
			}
		}

		return res;
	}

	function intersectMask(res, ref) {
	var	referencePixels = ref.data
	,	resultPixels = res.data
	,	i = resultPixels.length
	,	pos
		;

		while (i) {
			pos = i|3;
			resultPixels[pos] = Math.min(resultPixels[pos], referencePixels[pos]);
			i -= 4;
		}

		return res;
	}

	function combineMask(res, ref) {
	var	referencePixels = ref.data
	,	resultPixels = res.data
	,	i = resultPixels.length
	,	pos
		;

		while (i) {
			pos = i|3;
			resultPixels[pos] = Math.max(resultPixels[pos], referencePixels[pos]);
			i -= 4;
		}

		return res;
	}

	function invertAlpha(res) {
	var	resultPixels = res.data
	,	i = resultPixels.length
	,	pos
		;

		while (i) {
			pos = i|3;
			resultPixels[pos] = 255 - resultPixels[pos];
			i -= 4;
		}

		return res;
	}

	function getImageDataClone(img) {
		return new ImageData(new Uint8ClampedArray(img.data), w,h);
	}

	function getImageDataInverted(img) {
		return invertAlpha(getImageDataClone(img));
	}

	function getImageDataPadded(radius, invert) {
	var	res = new ImageData(w,h);

		if (radius) {
			addPadding(res, (radius > 0 ? ref : invRef), radius);
		} else {
			res.data.set(ref.data);
		}

		if (!invert === (radius < 0)) {
			invertAlpha(res);
		}

		return res;
	}

	if (!ctx || !padding) {
		return;
	}

	if (ctx.getContext) {
		ctx = ctx.getContext('2d');
	}

var	r = padding.radius;

	if (r) {
	var	r0 = r.in
	,	r1 = r.out
	,	t = padding.threshold
	,	t_min = (t === 'min')
	,	t_max = (t === 'max')
	,	t_dist = !(t_min || t_max)
	,	threshold = (
			t_dist
			? (orz(t) || PADDING_ALPHA_THRESHOLD_DEFAULT)
			: 0
		)
	,	w = ctx.canvas.width
	,	h = ctx.canvas.height
	,	ref = ctx.getImageData(0,0, w,h)
	,	invRef = (r0 < 0 || r1 < 0 ? getImageDataInverted(ref) : null)
	,	res = getImageDataPadded(r1)
		;

		if (typeof r0 !== 'undefined') {
			intersectMask(res, getImageDataPadded(r0, true));
		}

		ctx.putImageData(res, 0,0);
	}
}

function makeCanvasOpaqueAndGetItsMask(project, ctx) {
	project.rendering.layersBatchCount++;

var	canvas = cre('canvas')
,	w = canvas.width  = ctx.canvas.width
,	h = canvas.height = ctx.canvas.height
,	img = ctx.getImageData(0,0, w,h)
,	d = img.data
,	i = d.length
	;

	canvas.getContext('2d').putImageData(img, 0,0);

	while (i) d[i|3] = 255, i -= 4;

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
			,	'render nesting path: ' + layers.map(v => v.name).join(' / ')
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
	if (!img) return null;

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

function getCanvasFlipped(project, img, flipSide, isCopyNeeded) {
	if (!img) return null;

	if (!flipSide) {
		return (
			isCopyNeeded
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
	if (!img) return null;

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
		return img;
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
	ctx.drawImage(img, x,y);

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
			for (var layer of optionalColors) if (
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
var	selectedValue = gt('select', project.container).find(
		(s) => {
		var	selectedValue = s.value;

			if (
				isNotEmptyString(selectedValue)
			&&	sectionName === s.getAttribute('data-section')
			&&	listName === s.name
			) {
				return selectedValue;
			}
		}
	);

	return (
		isNotEmptyString(selectedValue)
		? selectedValue
		: defaultValue
	);
}

function getLayerPathVisibilityByValues(project, layer, values, listName) {
	if (layer.params.check_order === 'up') {
		if (getLayerVisibilityChain(layer).find(
			layer => !getLayerVisibilityByValues(project, layer, values, listName)
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
	var	max = -1
	,	unselectable = false
		;

		for (var listName of listNames) {
		var	v = getSelectedOptionValue(project, values, 'opacities', listName);

			if (v === null) {
				unselectable = true;
			} else {
				if (max < v) max = v;
				if (max >= 1) break;
			}
		}

		return (
			max < 0
			? (isVisible ? layer.opacity : 0)
			: (unselectable ? 1 : max)
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

async function getRenderByValues(project, values, layersBatch, renderParam) {

	async function renderOneLayer(layer) {

		function onReturnCleanup() {
			project.rendering.nestedLayers.pop();
		}

	var	names = layer.names
	,	params = layer.params
	,	skipColoring = !!params.if_only			//* <- check logical visibility, but skip recolor
	,	ignoreColors = !!renderParam.ignoreColors	//* <- only care about alpha channel, for mask generation
	,	clippingGroupWIP = !!renderParam.clippingGroupWIP
	,	clippingGroupResult = false
	,	backward = (
			layer.isOrderedBySide
		&&	side === 'back'
		)
	,	flipSide = orz(backward ? layer.flipSide : 0)
	,	p = project.rendering
		;

		p.nestedLayers.push(layer);
		p.nestedLevelMax = Math.max(p.nestedLevelMax, p.nestedLayers.length);

//* step over clipping group to render or skip at once:

		if (
			!clippingGroupWIP
		&&	!ignoreColors
		) {
		var	g_a = [layer]
		,	g_i = l_i
		,	g_l
			;

			while (
				(g_i-- > 0)
			&&	(g_l = l_a[g_i])
			&&	g_l.isClipped
			) {
				g_a.push(g_l);
			}

			if (g_a.length > 1) {
				l_i = g_i + 1;
				g_a.reverse();
				clippingGroupResult = true;
			}
		}

//* skip not visible, not selected, etc:

	var	opacity;

		if (
			!isLayerRendered(layer)
		||	!(opacity = renderParam.opacity || getLayerVisibilityByValues(project, layer, values))
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
			&&	layer !== bottomLayer
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
		&&	(canvas = renderParam.baseCanvas)
		) {
			ctx = canvas.getContext('2d');

			if (TESTING_RENDER) addDebugImage(project, canvas, 'renderParam.baseCanvas', 'green');
		}

//* render clipping group as separate batch:

		if (clippingGroupResult) {
			img = await getRenderByValues(
				project
			,	values
			,	g_a
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
					[layer.img]
					.concat(layers || [])
					.filter(arrayFilterNonEmptyValues)
				);

				aliases.forEach(
					alias => (
						getPropByNameChain(project, 'layersForCopyPaste', 'copy', alias)
					||	[]
					).forEach(
						layer => {
							if (layers.indexOf(layer) < 0) {
								layers.push(layer);
							}
						}
					)
				);
			}

			if (layers) {

//* get a flat color fill staright from a list:

				if (
					!skipColoring
				&&	layer.isColorList
				) {
					names.find(
						listName => !!(
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
					||	!!names.find(
							listName => (
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
							canvasCopy = getCanvasFlipped(project, canvas, flipSide, true);
						} else {
							l_a = l_a.slice(0, l_i).concat(layers);
							l_i = l_a.length;

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
				var	padding = null;

					names.find(
						listName => !!(
							padding = getSelectedOptionValue(project, values, 'paddings', listName)
						)
					);

					if (padding) {
						mask = await getRenderByValues(
							project
						,	values
						,	l_a.slice(0, l_i)	//* <- content after this layer
						,	{
								ignoreColors: true
							}
						);

						if (TESTING_RENDER) addDebugImage(project, mask, 'mask = getRenderByValues');

//* apply padding to generated mask:

						if (mask) {
							padCanvas(mask, padding);

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
						listName => {
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
		if (layersBatch) {
			project.rendering.layersBatchCount++;
		} else {
			logTime('getRenderByValues - skipped call without layers while rendering.');
			return;
		}
	} else {
		l_i = orz(getPropBySameNameChain(values, 'separate'));

		if (l_i > 0) {
			if (
				(layers = project.layersTopSeparated)
			&&	(layer = layers[l_i - 1])
			) {
			var	layersToRenderOne = (getParentLayer(layer) || project).layers;
			} else {
				logTime('getRenderByValues - skipped call, separate layer not found.');
				return;
			}
		}

		project.rendering = {
			startTime: +new Date
		,	fileName: getFileNameByValues(project, values)
		,	layersApplyCount: 0
		,	layersBatchCount: 1
		,	nestedLevelMax: 0
		,	nestedLayers: []
		,	colors: {}
		};
	}

var	l_a = layersToRenderOne || layersBatch || project.layers
,	l_i = l_a.length
,	l_k = 0
,	bottomLayer = l_a[l_i - 1]
,	renderParam = renderParam || {}
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
		l_k = layersToRenderOne.indexOf(layer);
		l_i = l_k + 1;
	}

	while (l_i-- > l_k) if (layer = l_a[l_i]) {

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

	if (!layersBatch) {
	var	renderingTime = +new Date - project.rendering.startTime
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

function getFileNameByValues(project, values, namingParam) {

	function getProcessedSectionName(sectionName) {

		function getProcessedListName(listName) {
		var	optionName = section[listName];

			if (!optionName.length) {
				return;
			}

		var	params = getPropByNameChain(project, 'options', sectionName, listName, 'params');
			if (params) {
				if (namingParam.checkSelectedValue) {
					if (
						params.single
					||	!params.batch
					) {
						return;
					}
				}

				if (namingParam.skipDefaultPercent) {
					if (
						(
							sectionName == 'zoom'
						&&	(
								orz(optionName) == 100
							||	orz(optionName) <= 0
							)
						)
					||	(
							ZERO_PERCENT_EQUALS_EMPTY
						&&	NAME_PARTS_PERCENTAGES.indexOf(sectionName) >= 0
						&&	orz(optionName) == 0
						)
					) {
						return;
					}
				}

				if (
					namingParam.addAllListNames
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

	if (!namingParam) namingParam = {};
	if (!values) values = getUpdatedMenuValues(project);

	return (
		NAME_PARTS_ORDER
		.map(getProcessedSectionName)
		.filter(arrayFilterNonEmptyValues)
		.join(NAME_PARTS_SEPARATOR)
	);
}

function getFileNameByValuesToSave(project, values, namingParam) {
	return (
		[
			project.baseName
		,	getFileNameByValues(project, values, namingParam)
		]
		.filter(arrayFilterNonEmptyValues)
		.join(NAME_PARTS_SEPARATOR)
		.replace(regSanitizeFileName, '_')
	);
}

async function getOrCreateRender(project, render) {
	if (!render) render = {};

var	values    = render.values    || (render.values    = getUpdatedMenuValues(project))
,	refValues = render.refValues || (render.refValues = JSON.parse(JSON.stringify(values, replaceJSONpartsFromNameToCache)))
,	refName   = render.refName   || (render.refName   = getFileNameByValuesToSave(project, refValues))
,	fileName  = render.fileName  || (render.fileName  = getFileNameByValuesToSave(project, values))
,	img       = render.img       || (render.img       = await getOrCreateRenderedImg(project, render))
	;

	return render;
}

function getImgElementPromise(canvas, fileName, w,h, callback) {
	if (!canvas) return;

	return new Promise(
		(resolve, reject) => {
		var	data = canvas.toDataURL()
		,	blob = dataToBlob(data)
		,	img = cre('img')
			;

			if (w > 0) img.width = w;
			if (h > 0) img.height = h;

			img.title = img.alt = fileName;
			img.onload = () => {
				if (callback) callback(img);

				resolve(img);
			}
			img.src = (blob ? blob.url : data);
		}
	);
}

async function getOrCreateRenderedImg(project, render) {

	function getAndCacheRenderedImgElementPromise(canvas, fileName, w,h) {
		return getImgElementPromise(
			canvas
		,	fileName + '.png'
		,	w || project.width
		,	h || project.height
		,	(img) => {
			var	ms = canvas.renderingTime;

				if (typeof ms !== 'undefined') {
					img.alt += (
						' \r\n('
					+	img.width + 'x' + img.height + ', '
					+	la.hint.took_sec.render.replace('$t', ms / 1000) + ')'
					);

					img.title = img.alt;
				}

				prerenders[fileName] = img;
			}
		);
	}

	if (!render) render = await getOrCreateRender(project);

	if (img = render.img) return img;

var	prerenders = (project.renders || (project.renders = {}))
,	fileName   = render.fileName
,	refName    = render.refName
,	values     = render.values
	;

	if (fileName in prerenders) {
		return prerenders[fileName];
	}

//* let UI update before creating new image:

	await pause(1);

var	img = prerenders[refName];

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
	&&	(z = getPropBySameNameChain(values, 'zoom'))
	&&	(z = orz(z))
	&&	z > 0
	&&	z != 100
	) {
	var	z
	,	x = z / 100
	,	canvas = cre('canvas')
	,	w = canvas.width  = Math.max(1, Math.round(x * project.width))
	,	h = canvas.height = Math.max(1, Math.round(x * project.height))
	,	ctx = canvas.getContext('2d')
		;

		ctx.drawImage(img, 0,0, w,h);

		img = await getAndCacheRenderedImgElementPromise(canvas, fileName, w,h);
	}

	return img;
}

function getNewLineOptionLists(project) {
var	options = project.options
,	optionsForNewLines = {}
	;

	for (var sectionName in options) {
	var	section = options[sectionName];

		for (var listName in section) {
		var	optionList = section[listName];

			if (getPropByNameChain(optionList, 'params', 'newline')) {
			var	o = optionsForNewLines;
				o = o[sectionName] || (o[sectionName] = []);

				if (o.indexOf(listName) < 0) {
					o.push(listName);
				}
			}
		}
	}

	return optionsForNewLines;
}

function getNewLineSubcontainer(container, values, options) {
	if (!values || !options) return container;

	for (var sectionName in options) {
	var	section = options[sectionName];

		for (var listName of section) {
		var	optionName = getPropByNameChain(values, sectionName, listName);

			if (optionName !== null) {
			var	optionID = [
					sectionName
				,	listName
				,	optionName
				].join('\n');

			var	e = getChildByAttr(container, 'data-option-id', optionID);

				if (!e) {
					e = cre('div', container);
					e.setAttribute('data-option-id', optionID);
				}

				container = e;
			}
		}
	}

	return container;
}

async function renderAll(project, flags) {
	setProjectWIPstate(project, true);

	if (!flags) flags = {};
	if (!flags.saveToFile) flags.showOnPage = true;

var	logLabel = 'Render all: ' + project.fileName;

	console.time(logLabel);
	console.group(logLabel);

var	startTime = +new Date
,	sets = getAllValueSets(project, true)
,	lastPauseTime = +new Date
,	setsCountWithoutPause = 0
,	setsCountTotal = Object.keys(sets).length
,	setsCount = 0
,	totalTime = 0
,	renderedImages = []
,	batchContainer = (flags.showOnPage ? getEmptyRenderContainer(project) : null)
,	needWaitBetweenDL = (flags.saveToFile && !flags.asOneJoinedImage)
,	optionsForNewLines = getNewLineOptionLists(project)
	;

	logTime(
		'"' + project.fileName + '"'
	+	' started rendering ' + setsCountTotal
	+	' sets (listing took ' + (lastPauseTime - startTime)
	+	' ms)'
	);

	for (var fileName in sets) {
	var	startTime = +new Date
	,	values = sets[fileName]
	,	render = await getOrCreateRender(
			project
		,	{
				'values': values
			,	'fileName': fileName
			}
		);

		if (flags.asOneJoinedImage) {
			if (img = await getRenderedImg(project, render)) {
				renderedImages.push(img);
			}
		} else {
			if (flags.showOnPage) await showImg(
				project,
				render,
				getNewLineSubcontainer(batchContainer, values, optionsForNewLines)
			);

			if (flags.saveToFile) await saveImg(
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

	var	endTime = +new Date;

		totalTime += (endTime - startTime);
		setsCount++;
		setsCountWithoutPause++;

//* https://stackoverflow.com/a/53841885
//* must wait at least 1 second between each 10 downloads in Chrome:

		if (
			needWaitBetweenDL
			? (setsCountWithoutPause > 9)
			: (endTime - lastPauseTime > 500)
		) {
			await pause(needWaitBetweenDL ? (100 * setsCountWithoutPause) : 100);

			lastPauseTime = +new Date;
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
	var	startTime = +new Date
	,	w = 0
	,	h = 0
	,	joinedBorder = Math.max(0, orz(getSelectedMenuValue(project, 'collage', 'border', JOINED_IMAGE_BORDER)))
	,	joinedPadding = Math.max(0, orz(getSelectedMenuValue(project, 'collage', 'padding', JOINED_IMAGE_PADDING)))
		;

		for (var img of renderedImages) {
			w += img.width + joinedPadding;
			h = Math.max(h, img.height);
		}

		if (w > 0 && h > 0) {
			w -= joinedPadding;
			w += joinedBorder << 1;
			h += joinedBorder << 1;
		}

		if (TESTING) console.log([
			'images:', renderedImages,
			'total width:', w,
			'total height:', h,
		]);

		if (w > 0 && h > 0) {
		var	canvas = cre('canvas')
		,	ctx = canvas.getContext('2d')
		,	x = joinedBorder
		,	y = joinedBorder
			;

			canvas.width = w;
			canvas.height = h;

			if (
				canvas.width != w
			||	canvas.height != h
			) {
			var	t = la.error.canvas_size;
				if (t.join) t = t.join('\n');

				alert(
					t + '\n'
				+	w + 'x' + h
				);
			} else {
				for (var img of renderedImages) {
					ctx.drawImage(img, x,y);
					x += img.width + joinedPadding;
				}

			var	img = await getImgElementPromise(
					canvas
				,	project.fileName + '.png'
				,	w,h
				,	(img) => {
						endTime = +new Date;
						totalTime = (endTime - startTime);

						img.alt += (
							' \r\n('
						+	w + 'x' + h + ', '
						+	(
								la.hint.took_sec.collage
								.replace('$t', totalTime / 1000)
								.replace('$n', renderedImages.length)
							) + ')'
						);

						img.title = img.alt;
					}
				);

				if (flags.showOnPage) getEmptyRenderContainer(project).appendChild(img);
				if (flags.saveToFile) saveDL(img.src, project.fileName + '_' + renderedImages.length, 'png', 1);
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
		console.log(error);

		project.rendering = null;
	}

	if (isSingleWIP) setProjectWIPstate(project, false);

	return !!img;
}

async function saveImg(project, render, fileName) {
	if (!render) var isSingleWIP = setProjectWIPstate(project, true);

	try {
		render = await getOrCreateRender(project, render);
		saveDL(render.img.src, fileName || render.fileName, 'png');
	} catch (error) {
		console.log(error);

		project.rendering = null;
	}

	if (isSingleWIP) setProjectWIPstate(project, false);

	return !!render;
}

async function getRenderedImg(project, render) {
	if (!render) var isSingleWIP = setProjectWIPstate(project, true);

	try {
	var	img = await getOrCreateRenderedImg(project, render);
	} catch (error) {
		console.log(error);

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

function updateCheckBox(e, params) {
	if (params || (params = e.params)) {
	var	switchType = e.getAttribute('data-switch-type')
	,	a = SWITCH_NAMES_BY_TYPE[switchType]
		;

		params[a[0]] = !(params[a[1]] = !!e.checked);
	}
}

function updateBatchCount(project) {

var	precounts = (project.renderBatchCounts || (project.renderBatchCounts = {}))
,	key = (
		(
			gc('batch-checkbox', project.container)
			.map(e => (e.checked ? 1 : 0))
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

	['show_all', 'save_all'].forEach(
		name => gn(name, project.container).forEach(
			e => {
				(e.lastElementChild || cre('span', e)).textContent = count;
			}
		)
	);
}

function setProjectWIPstate(project, isWIP) {
var	state = !!isWIP;

	project.isStopRequested = false;
	project.isBatchWIP = state;

	['button', 'select', 'input'].forEach(
		tagName => gt(tagName, project.container).forEach(
			e => (
				e.disabled = (
					tagName === 'button'
				&&	e.name === 'stop'
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
		e => {
			if (e.name !== 'download_all') {
				e.disabled = (
					e.name === 'stop'
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
	if (!TESTING && id('loaded-files-view').firstElementChild) {

//* Note: given message text won't be used in modern browsers.
//* https://habr.com/ru/post/141793/

	var	message = la.hint.close_page;

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
	eventStop(evt,1);

	gc('menu-hid').forEach(
		e => putInView(e, 0,0, true)
	);
}

function onPageKeyPress(evt) {
	if (evt.keyCode === 27) {	//* Esc
		gn('stop').forEach(
			e => e.click()
		);

		gc('loading', id('loaded-files-selection')).forEach(
			e => {
				(e.project || e).isStopRequested = true;
			}
		);
	}
}

function onProjectButtonClick(evt) {
var	e = evt;

	if (
		evt
	&&	evt.type
	&&	evt.type === 'click'
	&&	evt.target
	) {
		e = evt.target;
	}

	if (
		!e
	||	!e.tagName
	||	!(e = getThisOrParentByTagName(e, 'button'))
	) {
		return;
	}

	eventStop(evt,1);

var	container = getProjectContainer(e)
,	project = container.project
,	action = e.name
,	resetPrefix = 'reset_to_'
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
	if (action.substr(0, resetPrefix.length) === resetPrefix) {
		setAllValues(project, action.substr(resetPrefix.length));
	} else
	if (action === 'console_log') {
		console.log(project);

		alert(la.hint.see_console);
	} else {
		console.log([
			evt
		,	e
		,	container
		,	project
		,	'Unknown action: ' + action
		]);

		alert(la.error.unknown_button);
	}
}

function onProjectMenuUpdate(evt) {
var	e = evt;

	if (
		evt
	&&	evt.type
	&&	evt.type === 'change'
	&&	evt.target
	) {
		e = evt.target;
	}

	if (
		!e
	||	!e.tagName
	) {
		return;
	}

	if (e.type === 'checkbox') {
		updateCheckBox(e);

		if (e.getAttribute('data-switch-type') !== 'batch') {
			return;
		}
	}

var	container = getProjectContainer(e)
,	project = container.project
	;

	updateBatchCount(project);

	if (e.tagName.toLowerCase() === 'select') {
		updateMenuAndShowImg(project);
	}
}

function onPageDragOver(evt) {

	function isThereAnyFile(items) {
		for (var i = 0, k = items.length; i < k; i++) {
			if (items[i].kind == 'file') {
				return true;
			}
		}

		return false;
	}

	eventStop(evt).preventDefault();

var	d = evt.dataTransfer
,	files = d.files
,	items = d.items
	;

	d.dropEffect = (
		(files && files.length)
	||	(items && items.length && isThereAnyFile(items))
		? 'copy'
		: 'none'
	);
}

function onPageDrop(evt) {
var	evt = eventStop(evt,0,1)
,	filesToLoad = []
,	files, name, ext
	;

//* get list of files to process:

	for (var batch of [evt.dataTransfer, evt.target, evt.value, evt]) if (
		batch
	&&	(files = batch.files)
	&&	files.length
	) {
		for (var file of files) if (
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
	var	logLabel = 'Load ' + files.length + ' project files: ' + files.map(v => v.name).join(', ')
	,	loadedProjectsCount = 0
		;

		console.time(logLabel);
		console.group(logLabel);

		for (var file of files) {
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

var	isProjectLoaded = await addProjectView({
		url: url
	});

	console.groupEnd(logLabel);
	console.timeEnd(logLabel);

	return isProjectLoaded;
}

async function loadFromButton(e, inBatch) {

	function getButtonURL(e) {
	var	url = e.getAttribute('data-url');

		if (
			!url
		&&	(e = getThisOrParentByClass(e, 'example-file'))
		&&	(e = gt('a', e)[0])
		) {
			url = e.href;
		}

		return url;
	}

	if (!inBatch) {
		if (e.disabled) {
			return;
		}

		e.disabled = true;
	}

var	action, url;

	if (action = e.name || e.getAttribute('data-action')) {
	var	p = getThisOrParentByClass(e, regClassExampleFiles);

		if (action === 'stop') {
			isStopRequested = true;
		} else
		if (action === 'download_all') {
		var	countWithoutPause = 0;

			for (var a of gt('a', p)) if (a.download) {
				a.click();

//* https://stackoverflow.com/a/53841885
//* must wait at least 1 second between each 10 downloads in Chrome:

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

			for (var b of gt('button', p)) if (url = getButtonURL(b)) {
				urls.push(url);

				if (await loadFromButton(b, true)) {
					++isProjectLoaded;
				}

				if (isStopRequested) {
					isStopRequested = false;

					break;
				}
			}

			setGlobalWIPstate(false);
		} else {
			console.log([e, p, 'Unknown action: ' + action]);
		}
	} else
	if (url = getButtonURL(e)) {

//* show loading status:

	var	c = 'loading'
	,	p = getThisOrParentByClass(e, regClassExampleFile)
		;

		if (p && p.className) {
			if (p.className.indexOf(c) < 0) {
				toggleClass(p,c,1);
			} else {
				return;
			}
		}

//* process the file:

	var	isProjectLoaded = await loadFromURL(url);

//* remove loading status:

		if (p && p.className) {
			toggleClass(p,c,-1);
		}

	}

	if (!inBatch) {
		e.disabled = false;
	}

//* report error to user:

	if (
		!inBatch
	&&	!isProjectLoaded
	&&	(urls || url)
	&&	(
			urls && urls.length > 0
			? urls.find((url) => isURLFromDisk(url))
			: isURLFromDisk(url)
		)
	) {
	var	t = la.error.file_protocol;
		if (t.join) t = t.join('\n');

		alert(t);
	}

	return isProjectLoaded;
}

function selectProject(e) {
	if (e = getProjectButton(e)) {
	var	button = e.parentNode.firstElementChild;

		while (button) {
		var	state = (button === e ? 1 : -1);

			gi(button.id).forEach(
				e => toggleClass(e, 'show', state)
			);

			button = button.nextElementSibling;
		}
	}
}

function closeProject(e) {
	if (e = getProjectButton(e)) {
	var	c = e.className || '';

		if (regClassShow.test(c)) {
			selectProject(
				getNextSiblingByClass(e, regClassLoaded)
			||	getPreviousSiblingByClass(e, regClassLoaded)
			);
		}

		if (regClassLoading.test(c)) {
			toggleClass(e, 'failed', 1);

			e.isStopRequested = true;

			if (e.project) {
				e.project.isStopRequested = true;
			}
		}

		if (regClassLoaded.test(c)) {
			removeProjectView(e.id) && del(e);
		}
	}
}

//* Runtime: prepare UI *------------------------------------------------------

async function init() {
var	t = THUMBNAIL_SIZE
,	e,a,i,k,v
	;

	await loadLib(
		'config.js',
		libRootDir + 'composition.asm.js',
	);

	THUMBNAIL_SIZE = Math.abs(orz(THUMBNAIL_SIZE)) || t;

	if (CompositionModule = AsmCompositionModule) {
		CompositionFuncList = Object.keys(CompositionModule(window, null, new ArrayBuffer(nextValidHeapSize(0))));
	}

var	supportedFileTypesText = (
		fileTypeLoaders
		.reduce(
			(result, v,i,a) => result.concat(v.dropFileExts)
		,	[]
		)
		.filter(arrayFilterUniqueValues)
		.filter(arrayFilterNonEmptyValues)
		.map(v => v.toUpperCase())
		.sort()
		.join(', ')
	)
,	openingNotesText = la.menu.file.notes.join('<br>')
,	HTMLparts = {}
	;

	HTMLparts.file = (
		'<p>'
	+		la.menu.file.project
	+		':'
	+	'</p>'
	+	'<input type="file" onchange="onPageDrop(this)">'
	+	'<p>'
	+		la.menu.file.formats
	+		':\n'
	+		supportedFileTypesText
	+		'.'
	+	'</p>'
	+	'<hr>'
	+	'<p>'
	+		openingNotesText
	+	'</p>'
	);

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
			return tabs.map(
				(tabs) => getExampleButtonsRow(tabs, rowLength)
			).join('');
		}

		tabs = Object.entries(tabs);

	var	padCount = orz(rowLength) - orz(tabs.length)
	,	padHTML = (
			padCount > 0
			? '<td' + (
				padCount > 1
				? ' colspan="' + padCount + '"'
				: ''
			) + '></td>'
			: ''
		)
	,	tabsHTML = tabs.map(
			([name, text]) => (
				'<td>'
			+		'<button onclick="return loadFromButton(this)" name="'
			+			encodeTagAttr(name)
			+		'">'
			+			text
			+		'</button>'
			+	'</td>'
			)
		).join('')
		;

		return (
			'<tr class="batch-buttons">'
		+		padHTML
		+		tabsHTML
		+	'</tr>'
		);
	}

var	tabsCountMax = 0
,	examplesHTML = (
		exampleProjectFiles.map(
			v => {
			var	headerHTML = (
					v.subdir
					? '<header>'
					+	(la.menu.examples.subdirs[v.subdir] || v.subdir)
					+	':'
					+ '</header>'
					: ''
				)
			,	tabsCount = 0
			,	fileListHTML = (
					v.files.map(
						file => {
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
								: arrayFilteredJoin(
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
									file.thumbnail
									? '<img class="thumbnail" src="'
									+	encodeHTMLSpecialChars(file.thumbnail)
									+ '">'
									: ''
								)
							+	(
									file.preview
									? '<img class="thumbnail larger" src="'
									+	encodeHTMLSpecialChars(file.preview)
									+ '">'
									: ''
								)
							+	'</div>'
							)
						,	filePath = arrayFilteredJoin([exampleRootDir, v.subdir, fileName], '/')
						,	fileURL = filePath + '?t=' + file.modtime.replace(/\W+/g, '_')
						,	nameAttr = encodeTagAttr(fileName)
						,	pathAttr = encodeTagAttr(fileURL)
						,	dict = la.menu.examples.buttons
						,	downloadLink = (
								'<a href="'
							+		pathAttr
							+	'" download="'
							+		nameAttr
							+	'">'
							+		dict.download
							+	'</a>'
							)
						,	loadButton = (
								'<button onclick="return loadFromButton(this)'
							// +	'" data-url="'
							// +		pathAttr
							+	'">'
							+		dict.load
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
						,	tabsHTML = tabs.map(
								(v,i,a) => (
									'<td>'
								+		v
								+	'</td>'
								)
							).join('')
							;

							tabsCount = Math.max(tabsCount, tabs.length);
							tabsCountMax = Math.max(tabsCount, tabsCountMax);

							return (
								'<tr class="example-file">'
							+		tabsHTML
							+	'</tr>'
							);
						}
					).join('')
				);

			var	batchButtonsHTML = getExampleButtonsRow(la.menu.examples.batch_buttons, tabsCount)

				return (
					'<tbody class="example-file-type">'
				+		getExampleHeaderRow(headerHTML, tabsCount)
				+		fileListHTML
				+		batchButtonsHTML
				+		getExampleHeaderRow('<hr>', tabsCount)
				+	'</tbody>'
				);
			}
		).join('')
	)
,	batchButtonsHTML = getExampleButtonsRow(la.menu.examples.batch_buttons, tabsCountMax)
	;

	HTMLparts.examples = (
		'<table class="example-files">'
	+		examplesHTML
	+		'<tfoot>'
	+			batchButtonsHTML
	+		'</tfoot>'
	+	'</table>'
	);

	if (
		EXAMPLE_NOTICE
	&&	(v = la.menu.examples.notice)
	) {
		HTMLparts.examples += (
			'<p class="warning">'
		+		(v.join ? v.join('<br>') : v)
		+	'</p>'
		);
	}

var	aboutLinks = [
		{
			'header': la.menu.about.source
		,	'links': [
				['https://github.com/f2d/sprite_dress_up', 'GitHub']
			]
		}
	,	{
			'header': la.menu.about.page_lang
		,	'links': (
				gt('link')
				.filter(
					(e) => (
						e.getAttribute('rel') == 'alternate'
					&&	e.getAttribute('href')
					&&	e.getAttribute('hreflang')
					)
				).map(
					(e) => [
						e.getAttribute('href')
					,	e.getAttribute('hreflang').toUpperCase()
					]
				)
			)
		}
	,	{
			'pretext': '<hr>'
		,	'lines': la.menu.about.notes
		}
	];

	HTMLparts.about = (
		aboutLinks.map(
			(v) => (
				(v.pretext || '')
			+	'<p>'
			+	(
					v.header
					? v.header + ':<br>'
					: ''
				)
			+	(
					v.lines
					? v.lines.join('<br>')
					: ''
				)
			+	(
					v.links
					? v.links.map(
						([url, text]) => (
							'<a href="'
						+		encodeTagAttr(url)
						+	'">'
						+		text
						+	'</a>'
						)
					).join(', ')
					: ''
				)
			+	'</p>'
			)
		).join('')
	);

var	topMenuHTML = (
		Object.entries(la.menu)
		.map(
			([k, v]) => getDropdownMenuHTML(
				v.header || 'TODO'
			,	HTMLparts[k] || '<p>TODO</p>'
			)
		).join('')
	);

	document.body.innerHTML = (
		'<div class="menu-bar">'
	+		topMenuHTML
	+	'</div>'
	+	'<div id="loaded-files-selection"></div>'
	+	'<div id="loaded-files-view"></div>'
	);

	gc('thumbnail').map(
		(e) => {
			if (!e.firstElementChild) {
				setImageSrc(e);
			}
		}
	);

	setGlobalWIPstate(false);

//* drop event may not work without dragover:

	[
		['beforeunload',onBeforeUnload]
	,	['dragover',	onPageDragOver]
	,	['drop',	onPageDrop]
	,	['keypress',	onPageKeyPress]
	,	['resize',	onResize]
	].forEach(
		([k, v]) => window.addEventListener(k, v, false)
	);

	toggleClass(document.body, 'loading', -1);
	toggleClass(document.body, 'ready', 1);

	logTime('ready to work');
}

document.addEventListener('DOMContentLoaded', init, false);
