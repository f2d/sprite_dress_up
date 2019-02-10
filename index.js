
//* source file data:
//* TODO: read PSD layer masks.
//* TODO: save as ORA.

//* menu:
//* TODO: progress/status panel + [stop operation] button.
//* TODO: options menu: add/remove/copy/edit colors and outlines, or all list(s), maybe in textarea.
//* TODO: N px outline, select color and method:
//*	a) max alpha in +|- N px around,
//*	b) min distance to any non-transparent px (map the 0,N:N+1,+Inf range to 255:0).
//* TODO: zoom format in filenames: [x1, x1.00, x100%].

//* rendering:
//* TODO: arithmetic emulation of all blending operations, not native to JS.
//* TODO: arithmetic emulation of all operations in 16/32-bit until final result; to be optionally available as checkbox/selectbox.
//* TODO: decode layer data (PSD/PNG/etc) manually without using canvas, to avoid premultiplied-alpha (PMA - in Firefox, not in Chrome) while rendering.
//* TODO: img src: recompress using temporary canvas (bad with PMA), save whichever is shorter (original vs temp) as base64 or blob.
//* TODO: for files without merged image data - render ignoring options, but respecting layer visibility properties.

//* later when it works at all, try in spare time:
//* TODO: split functionality into modules to reuse with drawpad, etc.

//* Config *-------------------------------------------------------------------

var	regLayerNameToSkip		= /^(skip)$/i
,	regLayerNameParamOrComment	= /(?:^|[\s_]*)(?:\[([^\[\]]*)\]|\([^()]*\))(?:[\s_]*|$)/i
,	regLayerNameParamSplit		= /[\s,_]+/g
,	regLayerNameParamTrim		= getTrimReg('\\s,_')

//* examples of comments: "... (1) ... (copy 2) (etc)"
//* examples of params: "... [param] ... [param,param param_param]"

//* TODO: make visible user manual from notes and examples.
//* TODO: keep all parameters single-word if possible.

,	regLayerNameParamType = {
		'skip':		/^(skip)$/i
	,	'skip_render':	/^(skip|no)\W+(render)$/i
	,	'none':		/^(none)$/i
	,	'if_only':	/^(if|in)$/i
	,	'not':		/^(\!|not?)$/i
	,	'any':		/^(\?|any|some)$/i

	,	'color_code':	/^(?:rgba?\W*(\w.+)|(?:hex\W*|#)(\w+))$/i

	,	'colors':	/^(colou?r)s$/i
	,	'parts':	/^(option|part|type)s$/i

	,	'paddings':	/^(outline|inline)(?:\W+(box|out))?$/i
	,	'radius':	/^(.*?\d.*)px(?:\W+(max|min|\d+))?$/i

	,	'opacities':	/^(\d[\d\W]*)%(\d*)$/i
	,	'zoom':		/^x(\d[\d\W]*)%(\d*)$/i

	,	'side':		/^(front|back|reverse(?:\W+(hor|ver))?)$/i
	,	'multi_select':	/^(x(\d[\d\W]*)|optional)$/i
/*
examples of layer folder names with parameter syntax:

	"[if not any parts] body" = render contents of this folder if "parts: body" select box value is empty.
	"[if     any parts] body" = render contents of this folder if "parts: body" select box value is non-empty.
	"[if not colors]    hair" = render only those subfolders/layers, which are named not as the "colors: hair" select box value.
	"[if     colors]    hair" = render only those subfolders/layers, which are named same as the "colors: hair" select box value.

	Note: any amount of whitespace is ok.
	Note: [none] discards layer name for option ID, result equals empty name; may be used for clarity in logical sets.
	Note: [parts/colors] folder with [if/not/any] are intended for logical dependencies, and do not add options to selectable list.
	Note: [colors] folder without [if/not/any] gets replaced with selected color, or skipped if empty value is selected. Any layer inside it is added as option regardless of nesting depth, which is intended for logical dependencies and overwriting color value under same name.

examples of 'color_code':

	[#1]
	[#123]
	[#112233]
	[#11223344]
	[hex-1F2F3F4F]
	[rgb-255-123-0]
	[rgba-10-20-30-40]

	Note: missing RGB values are set to 0.
	Note: missing Alpha value is set to 255 (FF).

examples of 'paddings', 'radius':

	"[outline (1:2x3:4)px]  name" = [1 to 2] width x [3 to 4] height px radius, rectangle area around each pixel.
	"[outline (1x/2x/3x)px] name" = (1 or 2 or 3) px radius, square area.
	"[outline (-4:5)px-max] name" = [-4 to 5] px radius, rounded area, use max value around.

	Note: [inline]          fills a padded mask over layers below it in the same folder.
	Note: [outline]         fills a padded mask behind layers above it in the same folder.
	Note: [outline-out]     use a mask enclosed from outer side, fill inner areas and holes.
	Note: [outline-box]     use bounding rectangle as a mask.
	Note: [outline 5px-min] for each pixel use min value found inside 5px radius of source alpha.
	Note: [outline 5px-max] for each pixel use max value found inside 5px radius.
	Note: [outline 5px-16]  for each pixel use 100% alpha if any value inside 5px radius is above threshold 16 of 255.

examples of 'opacities':

	[100-50%]	(set opacity of this layer/folder to exactly 100 or 50%)
	[0/30/60/90%1]	(exactly (none or 30 or 60 or 90)%, preselect format version 1)

examples of 'zoom':

	[x50/100/200%]	(scale to (50 or 100 or 200)%, default shortest format in filenames)
	[x100-50-25%2]	(scale to (100 or 50 or 25)%, preselect format version 2)

	Note: applied to whole result image, so if needed - put this on topmost root layer for clarity.
	Note: first one listed is shown by default.
	Note: 100% is rendered first regardless of selection, then scaled up/down repeatedly by up to x2, until target scale is met.
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

examples of 'multi_select':

	[optional]	(1 or none)
	[x0-1]		(1 or none)
	[x1+]		(1 or more)
	[x2]		(exactly 2)
	[x]		(any, from none to all at once)

	Note: [parts] cannot be selected more than 1 at once currently.
	Note: [colors] cannot be selected more than 1 at once (they will overwrite anyway).
*/

//* preselect last (may be empty or not, depending on 'multi_select' param):
	,	'last':		/^(last)$/i

//* for batch export - iterate this list or only use selected variant (first found makes another to be default):
	,	'batch':	/^(batch)$/i
	,	'preselect':	/^(batch-fix|batch-single|no-batch|pre-?select)(-last)?$/i

//* for export filename - omit this list title:
//* TODO: add prefix automatically only if option names collide?
	,	'no_prefix':	/^(no-prefix)$/i
	}
,	regLayerBlendModePass	= /^pass[-through]*$/i
,	regLayerBlendModeAlpha	= /^(source|destination)-(\w+)$/i
,	regLayerTypeSingleTrim	= /s+$/i
,	regHasDigit		= /\d/
,	regNaN			= /\D+/g
,	regSpace		= /\s+/g
,	regCommaSpace		= /,+\s*/g
,	regTrim			= getTrimReg('\\s+')
,	regTrimNaN		= getTrimReg('\\D+')
,	regTrimNaNorSign	= getTrimReg('^\\d+-')
,	regTrimNewLine		= /[^\S\r\n]*(\r\n|\r|\n)/g
,	regHex3			= /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i
,	regHex68		= /^#?([0-9a-f]{6}|[0-9a-f]{8})$/i
,	regClassExampleFiles	= getClassReg('example-files|files')
,	regClassExampleFile	= getClassReg('example-file|file')
,	regClassLoadedFile	= getClassReg('loaded-file|file')
,	regClassMenuBar		= getClassReg('menu-bar')
,	regClassButton		= getClassReg('button')
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
// ,	LS = window.localStorage || localStorage
,	URL_API = window.URL || window.webkitURL
,	BLOB_PREFIX = 'blob:'
,	DATA_PREFIX = 'data:'
,	TYPE_TP = 'text/plain'
,	TOS = ['object', 'string']
,	FALSY_STRINGS = ['', 'false', 'no', 'none', 'null', 'undefined']
,	VIEW_SIDES = ['front', 'back']
,	VIEW_FLIPS = ['hor', 'ver']
,	NAME_PARTS_PERCENTAGES = ['zoom', 'opacities']
,	NAME_PARTS_FOLDERS = ['parts', 'colors']
,	NAME_PARTS_ORDER = ['parts', 'colors', 'paddings', 'opacities', 'side', 'zoom']
,	SPLIT_SEC = 60
,	MAX_OPACITY = 255
,	fileNameAddParamKey = true

,	BLEND_MODE_NORMAL = 'source-over'
,	BLEND_MODE_CLIP = 'source-atop'
,	BLEND_MODE_MASK = 'destination-in'
,	BLEND_MODE_ADD = 'lighter'

,	BLEND_MODES_REPLACE = [
		['src', 'source']
	,	['dst', 'destination']
	,	['liner', 'linear']
	,	['substruct', 'substract']
	,	[/^.*:/g]
	,	[/[\s\/_-]+/g, '-']
	,	[regLayerBlendModePass, 'pass']
	]
,	BLEND_MODES_REMAP = {
		'normal':	BLEND_MODE_NORMAL
	,	'add':		BLEND_MODE_ADD
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
,	BLEND_MODES_EMULATED = [
		'darker-color'
	,	'divide'
	,	'hard-mix'
	,	'lighter-color'
	,	'linear-burn'
	,	'linear-light'
	,	'pin-light'
	,	'substract'
	,	'vivid-light'
//* JS-native blending will be used automatically when available:
/*
	,	'color-burn'
	,	'color-dodge'
	,	'darken'
	,	'lighten'
	,	'lighter'
	,	'multiply'
	,	'overlay'
	,	'screen'
	,	'soft-light'
	,	'hard-light'

	,	'difference'
	,	'exclusion'

	,	'color'
	,	'hue'
	,	'saturation'
	,	'luminosity'
*/
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
,	TESTING = false
	;

//* Config: loaders of project files *-----------------------------------------

var	examplesDir = 'example_project_files/'
,	exampleProjectFiles = []
,	libDir = 'lib/'
,	libFormatsDir = libDir + 'formats/'
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
			]
		},

		'ora.js': {

//* source: https://github.com/zsgalusz/ora.js

//* no support for ORA in CSP/SAI
//* not enough supported features in Krita

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

//* TODO: layer opacity masks

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

//* TODO: layer opacity masks

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
			'dropFileExts': ['ora']
		,	'handlerFuncs': [
				loadORA,
			]
		},
		{
			'dropFileExts': ['psd']
		,	'handlerFuncs': [
				// loadPSD,
				loadPSDBrowser,
				loadPSDLIB,
			]
		},
	]
,	ora, zip, PSD, PSD_JS, PSDLIB
,	CompositionModule
,	CompositionFuncList
	;

//* Common utility functions *-------------------------------------------------

function pause(msec) {
	return new Promise(
		(resolve, reject) => {
			setTimeout(resolve, msec || 1000);
		}
	);
}

function dist(x,y) {return Math.sqrt(x*x + y*y)};
function getAlphaDataIndex(x,y,w) {return ((y*w + x) << 2) | 3;}

function hex2rgbArray(v) {
	if (v.length === 1) v += repeat(v, 5); else
	if (v.length === 3) v = v.replace(regHex3, '$1$1$2$2$3$3');
var	a = [];
	while (v.length > 1) {
		a.push(parseInt(v.substr(0,2), 16));
		v = v.substr(2);
	}
	return a;
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

function gc(n,p) {try {return Array.from((p || document).getElementsByClassName	(n));} catch (e) {return [];}}
function gt(n,p) {try {return Array.from((p || document).getElementsByTagName	(n));} catch (e) {return [];}}
function gn(n,p) {try {return Array.from((p || document).getElementsByName		(n));} catch (e) {return [];}}
function gi(n,p) {try {return Array.from((p || document).querySelectorAll('*[id="'+n+'"]'));} catch (e) {return [];}}
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

function getParentByClass(e,c) {
var	r = (c.test ? c : getClassReg(c));
	while (e) {
		if (e.className && r.test(e.className)) break;
		e = e.parentNode;
	}
	return e;
}

function getTargetParentByClass(e, c) {
	if (e && e.target) {
		e = e.target;
	}

	e = getParentByClass(e, c);

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
	+	'>'
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
var	p = getParentByClass(e, regClassMenuBar);
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
function orzFloat(n) {return orz(n, 4);}
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
	if (TOS.indexOf(typeof t) > -1) {
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
			var	a = e.target.response;

				if (a) {
					resolve(a);
				} else{
					reject(new Error('No response'));
				}
			});

			r.addEventListener('error', (e) => {
				reject(new Error('An error has occurred on request'));
			});

			r.open('GET', url, true);
			r.send();
		}
	);
}

function dataToBlob(data) {
	if (URL_API && URL_API.createObjectURL) {
	var	type = TYPE_TP;
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
var	type = TYPE_TP
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

var	lib = fileTypeLibs[libName] || {}
,	varName = lib.varName || ''
	;
	if (window[varName]) return true;

var	dir = lib.dir || ''
,	scripts = Array.from(lib.files || [])
	;
	if (!scripts.length) return false;

var	depends = lib.depends || null;
	if (depends) {
		if (depends.map) {
			for (var name of depends) await loadLibOnDemand(name);
		} else {
			await loadLibOnDemand(depends);
		}
	}

	return new Promise(
		(resolve, reject) => {

			function addNextScript(e) {
				var t;

//* some var init, no better place for this:

				if (varName === 'zip' && window[varName]) {
					if (!zip.workerScriptsPath) zip.workerScriptsPath = dir;
				}

				if (varName === 'ora' && window[varName]) {
					if (!ora.scriptsPath) ora.scriptsPath = dir;
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
					resolve(true);
				} else {

//* otherwise, cleanup and report fail:

					del(
						gn('script', document.head)
						.filter(
							function(e) {
								return e.getAttribute('data-lib-name') === libName;
							}
						)
					);
					resolve(false);
				}
			}

			addNextScript();
		}
	);
}

//* Page-specific functions: internal, utility *-------------------------------

function replaceJSONpartsFromPSD(key, value) {

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
}

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

function clearCanvasBeforeGC(ctx) {
	if (!ctx) return;

var	canvas = ctx.canvas || ctx
,	t = canvas.tagName
	;

	if (!t || t.toLowerCase() !== 'canvas') return;

	canvas.width = 1;
	canvas.height = 1;
}

function isImgElement(e) {
	return (
		e
	&&	e.tagName
	&&	e.tagName.toLowerCase() === 'img'
	);
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

function getOtherBatchParam(b) {
	return (b !== 'batch' ? 'batch' : 'preselect');
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

function getLayerPath(layer) {
var	path = [];

	while (layer = getParentLayer(layer)) {
		path.unshift(layer.name);
	}

	return path;
}

function isLayerSkipped(layer) {
	return (
		layer.params.skip
	||	regLayerNameToSkip.test(layer.name)
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
	var	e = targetLayer || this
	,	e = e.sourceData || e
	,	i = e.prerendered || e.thumbnail
		;
		if (i) return i;

		if (isImgElement(e = e.image || e)) {
			return e;
		}

		if (e.toPng && (i = e.toPng())) {
			return i;
		}
	} catch (error) {
		console.log(error);
	}

	return null;
}

//* Page-specific functions: internal, loading *-------------------------------

async function removeProjectView(fileID) {
var	countDeleted = gi(fileID).reduce(
		(count, e) => (del(e) ? ++count : count)
	,	0
	);

	if (countDeleted) {
		logTime('"' + fileID + '" closed');
	}
}

async function addProjectView(sourceFile) {

	if (!window.FileReader) {
		return false;
	}

var	buttonTab = cre('div', id('loaded-files-selection'));
	buttonTab.className = 'button loading';

var	button = cre('button', buttonTab);
	button.textContent = sourceFile.name;

	try {
	var	project = await getNormalizedProjectData(sourceFile)
	,	container = (
			await getProjectViewMenu(project)
		||	await getProjectViewImage(project)
		);
		if (container) {
		var	fileID = 'loaded-file: ' + sourceFile.name;

			removeProjectView(fileID);

		var	childKeys = ['layers']
		,	keysToRemove = ['loading', 'toPng']
			;
			if (!TESTING) {
				keysToRemove = keysToRemove.concat(['blendModeOriginal', 'nameOriginal', 'sourceData']);
			}
			cleanupObjectTree(project, childKeys, keysToRemove);

			container.id = buttonTab.id = fileID;
			container.className = 'loaded-file';

			if (project.options || TESTING) {
				container.project = project;
				project.container = container;
			}

			if (project.options) {
				updateMenuAndRender(project);
			}

			id('loaded-files-view').appendChild(container);

			buttonTab.className = 'button';

		var	buttonX = cre('button', buttonTab);
			buttonX.className = 'close-button';
			buttonX.textContent = 'X';

			buttonX.setAttribute('onclick', 'closeProject(this)');
			button.setAttribute('onclick', 'selectProject(this)');
			button.click();

			return true;
		}
	} catch (error) {
		console.log(error);

		del(button);
	}

	return false;
}

async function getNormalizedProjectData(sourceFile) {

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

var	startTime = +new Date
,	n = sourceFile.name
,	i = n.lastIndexOf('.')
,	b = (i < 0 ? n : n.substr(0, i))
,	ext = sourceFile.ext || getFileExt(n)
	;
	logTime('"' + n + '" started trying to parse');

	try_loaders:
	for (var ftl of fileTypeLoaders) if (ftl.dropFileExts.indexOf(ext) >= 0)
	for (var f of ftl.handlerFuncs) {
	var	project = {
			fileName: n
		,	baseName: b
		,	batch: {}
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
	}

	logTime(
		'"' + n + '"'
	+	(
			project
			? ' finished trying to parse, took '
			: ' failed trying to parse after '
		)
	+	(+new Date - startTime)
	+	' ms total'
	);

	return project;
}

async function getProjectViewMenu(project) {

	async function getProjectOptionsContainer(project) {

//* render default set when everything is ready:

		try {
		var	options = getProjectOptions(project);
			if (options) {
			var	result = true
			,	l_a = project.loading.images
			,	l_i = project.loading.imagesCount = l_a.length
				;

				logTime(l_i + ' images to preload.');

//* try loading one by one to avoid flood of errors:

				while (result && l_a.length > 0) {
					result = await getLayerImgLoadPromise(l_a.pop());
				}

				if (result) {
					logTime('"' + project.fileName + '" finished loading, took ' + (+new Date - project.loading.startTime) + ' ms');

					project.options = options;

				var	container = createProjectView(project);
					createOptionsMenu(project.options, gc('options', container)[0]);

					return container;
				}
			} else {
				logTime('"' + project.fileName + '" finished loading, took ' + (+new Date - project.loading.startTime) + ' ms, options not found.');
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

			function getOrAddOptionGroup(sectionName, listName) {
			var	sectionName = ''+sectionName
			,	listName    = ''+listName
			,	o = (options || (options = {}))
			,	o = (o[sectionName] || (o[sectionName] = {}))
			,	o = (o[listName] || (o[listName] = {
					'params': {}
				,	'items': {}
				}))
				;
				return o;
			}

			function checkBatchParams(globalOptionParams) {
				for (var k of [
					'batch',
					'preselect',
				]) if (params[k]) {
					if (!project.batch.paramNameDefault) {
						project.batch.paramNameMarked = k;
						project.batch.paramNameDefault = getOtherBatchParam(k);
					}
					globalOptionParams[k] = true;
				}
			}

			function addOptionGroup(sectionName, listName) {
			var	optionParams = getOrAddOptionGroup(sectionName, listName).params
			,	i,j,k,o
				;
				checkBatchParams(optionParams);

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
			}

			function addOptionItem(layer, sectionName, listName, optionName) {
				layer.isOption = true;

				if (!layer.type) {
					layer.type = sectionName.replace(regLayerTypeSingleTrim, '');
				}

			var	optionItems = getOrAddOptionGroup(sectionName, listName).items
			,	optionItemLayers = (optionItems[optionName] || (optionItems[optionName] = []))
				;
				if (optionName !== '') {
					optionItemLayers.push(layer);
				}
			}

			function addOptionsFromParam(sectionName, listName) {
			var	param = params[sectionName];
				if (!param) return;

			var	o = getOrAddOptionGroup(sectionName, listName || sectionName)
			,	optionParams = o.params
			,	optionItems = o.items
			,	i,j,k
				;
				checkBatchParams(optionParams);

				if (sectionName === 'side') {
					for (k in (j = la.side)) {
						optionItems[k] = j[k];
					}

					if (
						(j = VIEW_SIDES.indexOf(param)) >= 0
					||	params.if_only
					) {
						params[sectionName] = (
							params.if_only
							? VIEW_SIDES[params.not ? 0 : 1]
							: (params.not ? VIEW_SIDES[j ? 0 : 1] : param)
						);
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

		var	n = layer.name
		,	m = layer.names = (
				n
				.split(regCommaSpace)
				.filter(arrayFilterUniqueValues)
			);

			if (isLayerSkipped(layer)) {
				return;
			}

		var	params = layer.params
		,	layersInside = layer.layers
			;

			addOptionsFromParam('zoom');
			addOptionsFromParam('side');
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

			if (layersInside) {
				layer.layers = getUnskippedProcessedLayers(
					layersInside
				,	layer.isColorList
				||	layer.isInsideColorList
				);
			} else
			if (layer.opacity > 0) {
				project.loading.images.push(layer);
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
					if (
						isLayerSkipped(layer)
					||	(layer.clippingLayer && isLayerSkipped(layer.clippingLayer))
					) {
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

	var	options, k;
		project.layers = getUnskippedProcessedLayers(project.layers);

		if (!project.batch.paramNameDefault) {
			project.batch.paramNameDefault = k = 'batch';
			project.batch.paramNameMarked = getOtherBatchParam(k);
		}

		return options;
	}

	function getLayerImgLoadPromise(layer) {
		return new Promise(
			(resolve, reject) => {
				if (layer.img = getPropByNameChain(layer, 'params', 'color_code')) {
					resolve(true);

					return;
				}

			var	img, onImgLoad = async function(e) {
					if (layer.isColor) {
						layer.img = getFirstPixelRGBA(img);
					} else {
					var	i = layer.img = await getImgOptimized(img);
						i.top  = layer.top;
						i.left = layer.left;
					}

					resolve(true);
				}

				try {
					img = project.toPng(layer);
				} catch (error) {
					console.log(error);
				}

				if (img) {
					if (
						isImgElement(img)
					&&	!img.onload
					) {
						img.onload = onImgLoad;
					} else {
						onImgLoad();
					}
				} else {
					resolve(false);
				}
			}
		);
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

		t = [
			project.width + 'x'
		+	project.height + ' '
		+	la.project.pixels

		,	[
				(project.colorMode || '')
			,	t
			]
			.filter(arrayFilterNonEmptyValues)
			.join(' ')
		];

	var	i = project.loading.imagesCount
	,	j = project.layersCount
		;
		if (j) t.push(j + ' ' + la.project.layers);
		if (i) t.push(i + ' ' + la.project.images);

		if (sourceFile.size) t.push(sourceFile.size + ' ' + la.project.bytes);
		if (sourceFileTime)  t.push(la.project.date + ' ' + getFormattedTime(sourceFileTime));

		cre('div', e).innerHTML = (
			t
			.filter(arrayFilterNonEmptyValues)
			.join('<br>')
		);

//* add batch controls:

		for (var i in la.selection) {
		var	j = la.selection[i]
		,	b = j.buttons
		,	e = cre('section', header)
		,	h = cre('header', e)
		,	f = cre('footer', e)
			;
			h.textContent = j.title + ':';

			for (var k in b) addButton(f, b[k]).name = k;
		}

		container.addEventListener('click', onProjectButtonClick, false);
		container.addEventListener('change', onProjectMenuUpdate, false);

//* place for results:

		tr = cre('tr', cre('table', container));
		cre('td', tr).className = 'options';
		cre('td', tr).className = 'render';

		return container;
	}

	function createOptionsMenu(options, container) {
	var	container = delAllChildNodes(container || id('project-options'))
	,	sections = la.sections
	,	section
	,	optionList
	,	b = project.batch.paramNameDefault
	,	c = project.batch.paramNameMarked
		;

//* section = type of use (fill colors, draw parts):

		for (var sectionName in sections) if (section = options[sectionName]) {
		var	sectionBox = cre('section', container);
			sectionBox.textContent = sections[sectionName] + ':';

//* list box = set of parts:

			for (var listName in section) if (optionList = section[listName]) {
			var	items = optionList.items
			,	params = optionList.params
			,	hasEmptyOption = ('' in items)
				;
				params[c] = !(params[b] = (typeof params[c] === 'undefined'));

			var	optionBox = cre('div', sectionBox)
			,	label = cre('label', optionBox)
				;
				label.title = listName;
				label.textContent = listName + ':';

			var	i = cre('input', label, label.firstChild);
				i.type = 'checkbox';
				i.title = la.options.preselect;
				i.checked = params.preselect;
				i.params = params;

			var	s = cre('select', optionBox);
				s.name = listName;
				s.setAttribute('data-section', sectionName);

//* list item = each part:

				for (var optionName in items) {
				var	n = optionName;
					if (sectionName === 'side') {
						n = la.side[n] || n;
					} else
					if (NAME_PARTS_PERCENTAGES.indexOf(sectionName) >= 0) {
						if (n === '0%') {
							n = '';
							hasEmptyOption = true;
						}
					}
					addOption(s, n, optionName);
				}

				if (
					!hasEmptyOption
				&&	params.multi_select
				&&	params.multi_select.min <= 0
				) {
					addOption(s, '');
				}

				if (params.last) {
					s.value = s.options[s.options.length - 1].value;
				}

				s.initialValue = s.value;
			}
		}
	}

	return await getProjectOptionsContainer(project);
}

function getProjectViewImage(project) {
	if (
		project
	&&	project.toPng
	&&	(img = project.toPng())
	) {
	var	img
	,	e = cre('div')
	,	t = cre('header', e)
	,	d = cre('div', e)
		;
		t.textContent = la.error.options;
		d.className = 'preview';
		d.appendChild(img);

		return e;
	}

	return null;
}

function getNextParentAfterAddingLayerToTree(layer, sourceData, name, parentGroup, isLayerFolder) {
var	m,v
,	paramList = []
,	params = {}
	;

	layer.sourceData = sourceData;
	layer.nameOriginal = name;
	name = trim(name);

	while (m = name.match(regLayerNameParamOrComment)) {
		if (
			(m = m[1])
		&&	(m.length > 0)
		) {
			m
			.split(regLayerNameParamSplit)
			.map(trimParam)
			.filter(arrayFilterNonEmptyValues)
			.forEach(v => paramList.push(v));
		}
		name = trim(name.replace(regLayerNameParamOrComment, ''));
	}

	if (paramList.length > 0) {
		paramList = paramList.filter(arrayFilterUniqueValues);
		paramList.sort();

		for (var param of paramList) {
			for (var k in regLayerNameParamType) if (m = param.match(regLayerNameParamType[k])) {
				if (NAME_PARTS_FOLDERS.indexOf(k) >= 0) {
					if (!layer.type && isLayerFolder) {
						layer.type = k;
					}
				} else
				if (k === 'zoom' || k === 'opacities') {
					params[k] = {
						'values': getUniqueNumbersArray(m[1])
					,	'format': orz(m[2])
					};
				} else
				if (k === 'paddings') {
					params[k] = {
						'way': m[1]	//* <- inline|outline
					,	'form': m[2]	//* <- box|enclosed|etc
					};
				} else
				if (k === 'radius') {
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
											z => orz(
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
				} else {
					if (k === 'preselect' && param.indexOf('last') >= 0) {
						params.last = true;
					}
					if (k === 'side' && m[2]) {
						params[k] = m[2];
					} else {
						params[k] = param || k;
					}
				}
				break;
			}
		}

		if (k = layer.type) {
			if (params.if_only) {
				if (params.any) {
					layer.isOptionIfAny = true;
				} else {
					layer.isOptionIfList = true;
				}
			} else
			if (NAME_PARTS_FOLDERS.indexOf(k) >= 0) {
				layer.isOptionList = true;

				if (k === 'colors') {
					layer.isColorList = true;
				}
			}
		}
	}

	layer.name = (params.none ? '' : name);
	layer.params = params;
	layer.parent = parentGroup;
	parentGroup.push(layer);

	if (isLayerFolder) {
		parentGroup = layer.layers = [];
		parentGroup.parent = layer;
	}

	return parentGroup;
}

//* Page-specific functions: internal, loading from file *---------------------

async function loadCommonWrapper(project, libName, fileParserFunc, treeConstructorFunc) {
	if (!(await loadLibOnDemand(libName))) return;

	logTime('"' + project.fileName + '" started parsing with ' + libName);

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
			? ' finished parsing, took '
			: ' failed parsing after '
		)
	+	(+new Date - project.loading.startParsingTime)
	+	' ms'
	);

	if (sourceData) {
		if (TESTING) {
			project.sourceData = sourceData;
		}
		project.toPng = thisToPng;

		if (treeConstructorFunc(project, sourceData)) {
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
					ora.load(
						file
					,	resolve
					,	{getImageWithBlob: true}
					);
				}
			);
		}
	,	function treeConstructorFunc(project, sourceData) {
			if (!sourceData.layers) return;

		var	l_i = project.layersCount = (
				(sourceData.layersCount || 0)
			+	(sourceData.stacksCount || 0)
			);

			if (!l_i) return;

			project.width	= sourceData.width;
			project.height	= sourceData.height;

//* gather layers into a tree object:

			function addLayerToTree(layer, parentGroup) {
			var	n	= layer.name || ''
			,	mode	= layer.composite || ''
			,	mask	= layer.mask || null
			,	layers	= layer.layers || null
			,	isLayerFolder = (layers && layers.length > 0)
			,	layerWIP = {
					top:    orz(layer.top    || layer.y)
				,	left:   orz(layer.left   || layer.x)
				,	width:  orz(layer.width  || layer.w)
				,	height: orz(layer.height || layer.h)
				,	isClipped: getTruthyValue(layer.clipping)
				,	opacity:   orzFloat(layer.opacity)
				,	blendMode: getNormalizedBlendMode(
						layer.isolation === 'auto'
						? 'pass'
						: mode
					)
				,	blendModeOriginal: mode
				};

//* note: layer masks also may be emulated via compositing modes in ORA

				if (mask) {
					m = layerWIP.mask = getPropByAnyOfNamesChain(mask, 'img', 'image');
					m.top    = orz(mask.top  || mask.y);
					m.left   = orz(mask.left || mask.x);
					m.width  = orz(m.width   || mask.width);
					m.height = orz(m.height  || mask.height);
				}

				parentGroup = getNextParentAfterAddingLayerToTree(
					layerWIP
				,	layer
				,	n
				,	parentGroup
				,	isLayerFolder
				);

				if (isLayerFolder) {
					layers.forEach(v => addLayerToTree(v, parentGroup));
				}
			}

		var	parentGroup = project.layers = [];

			sourceData.layers.forEach(v => addLayerToTree(v, parentGroup));

			return true;
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
	,	function treeConstructorFunc(project, sourceData) {
			if (!sourceData.layers) return;

		var	l_i = project.layersCount = sourceData.layers.length;

			if (!l_i) return;

		var	m = sourceData.header.mode;

			project.width	= sourceData.header.cols;
			project.height	= sourceData.header.rows;
			project.colorMode	= (isNaN(m) ? m : PSD_COLOR_MODES[m]);
			project.channels	= sourceData.header.channels;
			project.bitDepth	= sourceData.header.depth;

//* gather layers into a tree object:

			function addLayerToTree(layer, parentGroup) {
			var	l	= layer.layer || layer
			,	n	= layer.name  || l.name  || ''
			,	img	= layer.image || l.image || null
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
			,	isLayerFolder = (layers && layers.length > 0)
			,	layerWIP = {
					top:    orz(l.top)
				,	left:   orz(l.left)
				,	width:  orz(l.width)
				,	height: orz(l.height)
				,	isClipped: getTruthyValue(clipping)
				,	opacity:   getNormalizedOpacity(l.opacity) * fillOpacity
				,	blendMode: getNormalizedBlendMode(
						regLayerBlendModePass.test(modePass)
						? modePass
						: mode
					)
				,	blendModeOriginal: mode
				};

//* TODO: mask

				parentGroup = getNextParentAfterAddingLayerToTree(
					layerWIP
				,	layer
				,	n
				,	parentGroup
				,	isLayerFolder
				);

				if (isLayerFolder) {
					layers.forEach(v => addLayerToTree(v, parentGroup));
				}
			}

		var	parentGroup = project.layers = [];

			sourceData.tree().children().forEach(v => addLayerToTree(v, parentGroup));

			return true;
		}
	);
}

async function loadPSDLIB(project) {
	return await loadCommonWrapper(
		project
	,	'PSDLIB.js'
	,	async function fileParserFunc(file) {
			return PSDLIB.parse(file);
		}
	,	function treeConstructorFunc(project, sourceData) {
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

//* layer masks are not supported here yet

				var	mode = layer.blendMode || ''
				,	layerWIP = {
						top:    orz(layer.top)
					,	left:   orz(layer.left)
					,	width:  orz(layer.width)
					,	height: orz(layer.height)
					,	isClipped: getTruthyValue(layer.clipping)
					,	opacity:   getNormalizedOpacity(layer.opacity)
					,	blendMode: getNormalizedBlendMode(mode)
					,	blendModeOriginal: mode
					};

					parentGroup = getNextParentAfterAddingLayerToTree(
						layerWIP
					,	layer
					,	n
					,	parentGroup
					,	isLayerFolder
					);
				}
			}

			return true;
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

//* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#Deep_Clone

	var	testValues = JSON.parse(JSON.stringify(values));

		testValues[sectionName][listName] = optionName;

		for (var layer of o) {
			if (getLayerPathVisibilityByValues(project, layer, testValues)) {
				return true;
			}
		}
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

function setAllValues(project, toFirst) {
	gt('select', project.container).forEach(
		s => {
			if (toFirst > 0) {
				s.value = s.options[0].value;
				return;
			}

			if (toFirst < 0) {
				s.value = s.initialValue;
				return;
			}

			for (o of s.options) if ('' === o.value) {
				s.value = o.value;
				return;
			}

			for (o of s.options) if ('' === trim(o.textContent)) {
				s.value = o.value;
				return;
			}
		}
	);

	showImg(project);
}

function getAllMenuValues(project, checkPreselected) {
var	values = {};

	gt('select', project.container).forEach(
		s => {
		var	sectionName = s.getAttribute('data-section')
		,	listName    = s.name
		,	optionLists = (values[sectionName] || (values[sectionName] = {}))
			;
			optionLists[listName] = (
				(
					checkPreselected
				&&	getPropByNameChain(project, 'options', sectionName, listName, 'params', 'preselect')
				)
				? [s.value]
				: gt('option', s).map(o => o.value)
			);
		}
	);

	return values;
}

function getAllValueSets(project, checkPreselected) {

	function goDeeper(optionLists, partialValueSet) {
		if (
			optionLists
		&&	optionLists.length > 0
		) {
		var	optionList  = optionLists[0]
		,	sectionName = optionList.sectionName
		,	listName    = optionList.listName
		,	optionNames = optionList.optionNames
		,	optionsLeft  = (
				optionLists.length > 1
				? optionLists.slice(1)
				: null
			);

			for (var optionName of optionNames) {
			var	values = JSON.parse(JSON.stringify(partialValueSet || {}))
			,	section = (values[sectionName] || (values[sectionName] = {}))
				;
				section[listName] = optionName;

				if (optionsLeft) {
					goDeeper(optionsLeft, values);
				} else
				if (isSetOfValuesOK(project, values = getSetOfRelevantValues(project, values))) {
				var	fileName = getFileNameByValuesToSave(project, values);

					if (!(fileName in resultSets)) {
						resultSets[fileName] = values;
					}
				}
			}
		}
	}

var	values = getAllMenuValues(project, checkPreselected)
,	resultSets = {}
,	optionLists = []
,	section
,	sectionName
,	optionNames
,	listName
	;

	for (var sectionName in values) if (section = values[sectionName])
	for (var listName in section) if (optionNames = section[listName]) {
		optionLists.push({
			'sectionName': sectionName
		,	'listName'   : listName
		,	'optionNames': optionNames
		});
	}

	goDeeper(optionLists);

	return resultSets;
}

function getMenuValues(project, updatedValues) {
var	values = {};

	gt('select', project.container).forEach(
		s => {

//* 1) check current selected values:

		var	sectionName   = s.getAttribute('data-section')
		,	listName      = s.name
		,	selectedValue = s.value
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
					var	optionName = o.value
					,	hide = !isOptionRelevant(project, updatedValues, sectionName, listName, optionName)
						;
						if (hide) {
							if (optionName === selectedValue) {
								selectedValueHidden = true;
							}
						} else {
							if (optionName) {
								fallbackValue = optionName;
							}
						}
						if (!hide && optionName) {
							allHidden = false;
						}
						if (!o.hidden === hide) {
							o.hidden = hide;
						}
					}
				);
			var	hide = (allHidden ? 'none' : '')
			,	style = s.parentNode.style
				;
				if (!hide && selectedValueHidden) {
					s.value = fallbackValue;
				}
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
		: getMenuValues(project, values)
	);
}

function getOrCreateReusableHeap(project) {
var	buffer = project.renderingBuffer;

	if (!buffer) {
	var	realSize = project.width * project.height * 4 * 2
	,	paddedSize = nextValidHeapSize(realSize)
	,	buffer = project.renderingBuffer = new ArrayBuffer(paddedSize)
		;
	}

	return new Uint8Array(buffer);
}

function drawImageOrColor(project, ctx, img, blendMode, opacity) {

	function drawImageOrColorInside() {
		if (
			img.join
		||	img.split
		||	typeof img === 'string'
		) {
			ctx.fillStyle = '' + (
				img.join
				? (
					(img.length > 3 ? 'rgba' : 'rgb')
				+	'('
				+		img.slice(0,4).map(orzFloat).join(',')
				+	')'
				)
				: img
			);
			ctx.fillRect(0,0, w,h);
		} else {
			ctx.drawImage(img, x,y);
		}
	}

	function tryBlendingEmulation(blendMode) {

		function tryEmulation(blendMode, callback) {

//* get pixels of layer below (B):

			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = BLEND_MODE_NORMAL;

		var	oldData = ctx.getImageData(0,0, w,h)
		,	b = oldData.data
			;

//* get pixels of layer above (A):

			ctx.clearRect(0,0, w,h);
			ctx.globalAlpha = opacity;

			drawImageOrColorInside();

		var	newData = ctx.getImageData(0,0, w,h)
		,	a = newData.data
			;

//* compute resulting pixels linearly into newData, and save result back onto canvas:

		var	isDone = callback(a,b, blendMode);

			ctx.putImageData(isDone ? newData : oldData, 0,0);

			return isDone;
		}

		function usingAsmJS(a,b, blendMode) {
			try {
			var	i = a.length
			,	uint8array = getOrCreateReusableHeap(project)
			,	env = null
			,	heap = uint8array.buffer
			,	compute = CompositionModule(window, env, heap)
				;
				uint8array.set(b, 0);
				uint8array.set(a, i);

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
		&&	tryEmulation(blendMode, usingAsmJS)
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
		;

//* use native JS blending if available, or emulation fails/unavailable:

		if (
			m === blendMode
		||	!tryBlendingEmulation(blendMode)
		) {
			ctx.globalAlpha = opacity;

			drawImageOrColorInside();
		}

		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = BLEND_MODE_NORMAL;
	}

	return canvas;
}

function padCanvas(ctx, padding) {

	if (!ctx || !padding) return;

var	w = ctx.canvas.width
,	h = ctx.canvas.height
,	r = padding.radius
,	t = padding.threshold
,	t_min = (t === 'min')
,	t_max = (t === 'max')
,	threshold = (
		!(t_min || t_max)
		? (orz(t) || 16)
		: 0
	);
	if (r) {
	var	r0 = r.in
	,	r1 = r.out
	,	ref = ctx.getImageData(0,0, w,h)
	,	res = ctx.getImageData(0,0, w,h)
	,	referencePixels = ref.data
	,	resultPixels    = res.data
	,	resultValue, distMin
		;
		for (var y = h; y--;) next_result_pixel:
		for (var x = w; x--;) {
		var	pos = getAlphaDataIndex(x,y,w);

			if (t_min) resultValue = 255; else
			if (t_max) resultValue = 0; else
			if (threshold) distMin = +Infinity;

			look_around:
			for (var ydy, dy = -r1; dy <= r1; dy++) if ((ydy = y + dy) >= 0 && ydy < h)
			for (var xdx, dx = -r1; dx <= r1; dx++) if ((xdx = x + dx) >= 0 && xdx < w) {
			var	alpha = referencePixels[getAlphaDataIndex(xdx, ydy, w)];
				if (threshold) {
					if (alpha > threshold) {
					var	d = dist(dx, dy) + 1 - alpha/255;
						if (d > r1) {
							if (distMin > d) distMin = d;
						} else {
							resultPixels[pos] = 255;
							continue next_result_pixel;
						}
					}
				} if (t_min) {
					if (resultValue > alpha) resultValue = alpha;
					if (resultValue == 0) break look_around;
				} else {
					if (resultValue < alpha) resultValue = alpha;
					if (resultValue == 255) break look_around;
				}
			}

			if (threshold) {
			var	distFloor = Math.floor(distMin);
				resultPixels[pos] = (
					distFloor > r1
					? 0
					: (255 * (1 + distFloor - distMin))
				);
			} else {
				resultPixels[pos] = resultValue;
			}
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

function getCanvasFlipped(project, img, isVerticalFlip) {
	if (isVerticalFlip < 0) {
		return img;
	}

	project.rendering.layersBatchCount++;

var	canvas = cre('canvas')
,	ctx = canvas.getContext('2d')
,	w = canvas.width  = orz(img.width)  || project.width
,	h = canvas.height = orz(img.height) || project.height
,	x = canvas.left   = orz(img.left)
,	y = canvas.top    = orz(img.top)
	;

//* https://stackoverflow.com/a/3129152

	if (isVerticalFlip) {
		ctx.translate(0, h);
		ctx.scale(1, -1);
	} else {
		ctx.translate(w, 0);
		ctx.scale(-1, 1);
	}
	ctx.drawImage(img, 0,0);

	return canvas;
}

function getCanvasBlended(project, imgBelow, imgAbove, mode, maskOpacity) {
	project.rendering.layersBatchCount++;

var	canvas = cre('canvas')
,	ctx = canvas.getContext('2d')
	;
	canvas.width  = project.width;
	canvas.height = project.height;

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
			&&	getLayerPathVisibilityByValues(project, layer, values)
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
var	selectedName = getPropByNameChain(values, sectionName, listName);
	return getProjectOptionValue(project, sectionName, listName, selectedName);
}

function getLayerPathVisibilityByValues(project, layer, values) {
	do {
		if (!getLayerVisibilityByValues(project, layer, values)) {
			return false;
		}
	} while (layer = layer.clippingLayer || getParentLayer(layer));

	return true;
}

function getLayerVisibilityByValues(project, layer, values) {

	function skipByFunc(layer, callback) {
		if (
			layer.names
			? layer.names.every(callback)
			: callback(layer.name)
		) {
			return true;
		}

		return false;
	}

	function skipByAnyName(listName) {
	var	selectedName = getPropByNameChain(values, layer.type, listName) || ''
		;
		if (!layer.params.not === !selectedName) {
			return true;
		}

		return false;
	}

	function skipBySpecificName(optionName) {

		function skipByListName(listName) {
		var	selectedName = getPropByNameChain(values, parent.type, listName) || ''
			;
			if (
				(optionName === selectedName)
				!==
				(!layer.params.not === !parent.params.not)
			) {
				return true;
			}

			return false;
		}

		if (skipByFunc(parent, skipByListName)) {
			return true;
		}

		return false;
	}

//* skip by explicit name or param:

	if (isLayerSkipped(layer)) {
		return;
	}

//* skip not selected parts:

	if (layer.isOptionIfAny) {
		if (skipByFunc(layer, skipByAnyName)) {
			return;
		}
	}

	if (
		layer.isOption
	||	layer.isOptionIf
	) {
	var	parent = (
			layer.isColor
			? getParentLayer(layer, 'isInsideColorList', false)
			: getParentLayer(layer)
		);
		if (skipByFunc(layer, skipBySpecificName)) {
			return;
		}
	}

	if (layer.isOnlyForOneSide) {
	var	selectedName = getPropBySameNameChain(values, 'side')
		;
		if (layer.params.side !== selectedName) {
			return;
		}
	}

//* skip fully transparent:

var	opacity = layer.opacity;

	layer.names.find(
		listName => {
		var	v = getSelectedOptionValue(project, values, 'opacities', listName);

			if (v !== null) {
				opacity = v;
				return true;
			}
		}
	);

	if (opacity > 0) {
		return opacity;
	}
}

function getRenderByValues(project, values, layersBatch, renderParam) {

	if (!project || !project.layers) {
		return;
	}

	if (project.loading) {
		logTime('getRenderByValues - skipped while loading project.');
		return;
	}

	if (!project.rendering) {
		project.rendering = {
			startTime: +new Date
		,	layersApplyCount: 0
		,	layersBatchCount: 1
		,	colors: {}
		};
	} else
	if (layersBatch) {
		project.rendering.layersBatchCount++;
	}

var	canvas = cre('canvas')
,	ctx = canvas.getContext('2d')
,	l_a = layersBatch || project.layers
,	l_i = l_a.length
,	bottomLayer = l_a[l_i - 1]
,	renderParam = renderParam || {}
,	side = getPropBySameNameChain(values, 'side')
,	layers, layer, opacity, clippingMask
	;
	canvas.width  = project.width;
	canvas.height = project.height;

	while (l_i-- > 0) if (layer = l_a[l_i]) {
	var	names = layer.names
	,	params = layer.params
	,	skipColoring = !!params.if_only
	,	clippingGroupWIP = !!renderParam.clippingGroupWIP
	,	clippingGroupResult = false
	,	backward = (
			layer.isOrderedBySide
		&&	side === 'back'
		);

//* step over clipping group to render or skip at once:

		if (
			!clippingGroupWIP
		&&	!renderParam.ignoreColors
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

		if (
			params.skip_render
		||	!(opacity = getLayerVisibilityByValues(project, layer, values))
		) {
			continue;
		}

//* skip unrelated to alpha composition when getting mask for padding:

	var	blendMode = layer.blendMode;

		if (renderParam.ignoreColors) {
			if (!regLayerBlendModeAlpha.test(blendMode)) {
				blendMode = BLEND_MODE_NORMAL;
			}

			if (
				layer.isClipped
			&&	layer !== bottomLayer
			&&	blendMode === BLEND_MODE_NORMAL
			) {
				continue;
			}
		}

	var	img = null;

//* render clipping group as separate batch:

		if (clippingGroupResult) {
			img = getRenderByValues(
				project
			,	values
			,	g_a
			,	{
					ignoreColors: renderParam.ignoreColors
				,	clippingGroupWIP: true
				}
			);
		} else

//* get layer/folder/batch as flat image:

		if (layers = layer.layers) {
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
			if (layers.length > 0) {
				if (blendMode == 'pass') {
					l_a = l_a.slice(0, l_i).concat(layers);
					l_i = l_a.length;

					continue;
				} else {
					img = getRenderByValues(
						project
					,	values
					,	(
							backward
							? Array.from(layers).reverse()
							: layers
						)
					,	{
							ignoreColors: renderParam.ignoreColors
						}
					);
				}
			}
		} else {
			img = layer.img;
		}

		if (img) {
			if (!clippingGroupResult) {

//* apply mask:

			var	mask = null;

				if (layer.isMaskGenerated) {
				var	padding = null;

					names.find(
						listName => !!(
							padding = getSelectedOptionValue(project, values, 'paddings', listName)
						)
					);

					if (padding) {
						mask = getRenderByValues(
							project
						,	values
						,	l_a.slice(0, l_i)
						,	{
								ignoreColors: true
							,	padding: padding
							}
						);
					}
				} else {
					mask = layer.mask;
				}

				if (mask) {
					img = getCanvasBlended(project, img, mask, BLEND_MODE_MASK);

					clearCanvasBeforeGC(mask);
				}

//* apply color:

				if (
					!skipColoring
				&&	!layer.isColorList
				&&	!renderParam.ignoreColors
				) {
					names.forEach(
						listName => {
							img = getCanvasColored(project, values, listName, img);
						}
					);
				}

//* flip:

				if (backward) {
					img = getCanvasFlipped(project, img, VIEW_FLIPS.indexOf(params.side));
				}
			}

//* add content to current buffer canvas:

			drawImageOrColor(project, ctx, img, blendMode, opacity);

			++project.rendering.layersApplyCount;

//* store the mask of the clipping group:

			if (
				clippingGroupWIP
			&&	layer === bottomLayer
			) {
				clippingMask = makeCanvasOpaqueAndGetItsMask(project, ctx);
			}

			clearCanvasBeforeGC(img);
		}
	}

//* end of layer batch iteration.
//* apply stored mask to the blended clipping group content:

	if (mask = clippingMask) {
		drawImageOrColor(project, ctx, mask, BLEND_MODE_MASK);

		clearCanvasBeforeGC(mask);
	}

//* apply padding:

	if (padding = renderParam.padding) {
		padCanvas(ctx, padding);
	}

//* end of layer tree:

	if (!layersBatch) {
		logTime(
			'rendered in '
		+	[	project.rendering.layersBatchCount + ' canvas elements'
			,	project.rendering.layersApplyCount + ' blending steps'
			,	(+new Date - project.rendering.startTime) + ' ms'
			,	'subtitle'
			].join(', ')
		,	getFileNameByValues(project, values)
		);

		project.rendering = null;
	}

	return canvas;
}

function getFileNameByValues(project, values, checkPreselected, skipDefaultPercent) {

	function getProcessedSectionName(sectionName) {

		function getProcessedListName(listName) {
		var	optionName = section[listName];

			if (!optionName.length) {
				return;
			}

		var	params = getPropByNameChain(project, 'options', sectionName, listName, 'params');
			if (params) {
				if (checkPreselected) {
					if (
						params.preselect
					||	!params.batch
					) {
						return;
					}
				}

				if (skipDefaultPercent) {
					if (
						(sectionName == 'zoom'      && orz(optionName) == 100)
					||	(sectionName == 'opacities' && orz(optionName) == 0)
					) {
						return;
					}
				}

				if (
					fileNameAddParamKey
				&&	!params.no_prefix
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
			.join('_')
		);
	}

	if (!values) {
		values = getMenuValues(project);
	}

	return (
		NAME_PARTS_ORDER
		.map(getProcessedSectionName)
		.filter(arrayFilterNonEmptyValues)
		.join('_')
	);
}

function getFileNameByValuesToSave(project, values, checkPreselected, skipDefaultPercent) {
	return (
		[
			project.baseName
		,	getFileNameByValues(project, values, checkPreselected, skipDefaultPercent)
		]
		.filter(arrayFilterNonEmptyValues)
		.join('_')
	);
}

async function getOrCreateRender(project, render) {
	if (!render) render = {};
var	values    = render.values    || (render.values    = getMenuValues(project))
,	refValues = render.refValues || (render.refValues = JSON.parse(JSON.stringify(values, replaceJSONpartsFromNameToCache)))
,	refName   = render.refName   || (render.refName   = getFileNameByValuesToSave(project, refValues))
,	fileName  = render.fileName  || (render.fileName  = getFileNameByValuesToSave(project, values))
,	img       = render.img       || (render.img       = await getOrCreateRenderedImg(project, render))
	;
	return render;
}

async function getOrCreateRenderedImg(project, render) {

	function getAndCacheRenderedImgElement(canvas, fileName, w,h) {
		if (!canvas) return;

		return new Promise(
			(resolve, reject) => {
			var	data = canvas.toDataURL()
			,	blob = dataToBlob(data)
			,	img = cre('img')
				;
				img.width  = w || project.width;
				img.height = h || project.height;
				img.title = img.alt = fileName;
				img.onload = () => resolve(img);
				img.src = (blob ? blob.url : data);

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

	if (img = prerenders[fileName]) return img;

var	img = prerenders[refName];

	if (!img) {
		if (fileName == refName) {
			canvas = getRenderByValues(project, values);
			img = await getAndCacheRenderedImgElement(canvas, refName);
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

		img = await getAndCacheRenderedImgElement(canvas, fileName, w,h);
	}

	return img;
}

function updateMenuAndRender(project) {
	if (!project) {
		return;
	}

	if (project.loading) {
		logTime('updateMenuAndRender - skipped while loading project.');
		return;
	}

	showImg(project);
}

async function renderAll(project, saveToFile, showOnPage) {
	if (!(saveToFile || showOnPage)) return;

var	logLabel = 'Render all: ' + project.fileName;

	console.time(logLabel);
	console.group(logLabel);

var	sets = getAllValueSets(project, true)
,	setsCountWithoutPause = 0
,	setsCount = 0
,	totalTime = 0
,	lastPauseTime = +new Date
	;
	for (var fileName in sets) if (values = sets[fileName]) {
	var	startTime = +new Date
	,	render = await getOrCreateRender(
			project
		,	{
				'values': values
			,	'fileName': fileName
			}
		);
		if (saveToFile) await saveImg(project, render, getFileNameByValuesToSave(values, true, true));
		if (showOnPage) await showImg(project, render, true);

	var	endTime = +new Date;

		totalTime += (endTime - startTime);
		setsCount++;
		setsCountWithoutPause++;

//* https://stackoverflow.com/a/53841885/8352410
//* must wait at least 1 second between each 10 downloads in Chrome:

		if (
			(setsCountWithoutPause > 9)
		||	(endTime - lastPauseTime > 500)
		) {
			await pause(saveToFile ? (100 * setsCountWithoutPause) : 100);
			lastPauseTime = +new Date;
			setsCountWithoutPause = 0;
		}
	}

	logTime('finished rendering ' + setsCount + ' sets, total ' + totalTime + ' ms (excluding pauses)');

	console.groupEnd(logLabel);
	console.timeEnd(logLabel);
}

function saveAll(project) {renderAll(project,1,0);}
function showAll(project) {renderAll(project,0,1);}

async function showImg(project, render, inBatch) {
	try {
	var	container = project.container
	,	imgContainer = gc('render', container)[0] || container
	,	img = await getOrCreateRenderedImg(project, render)
		;

//* prepare image before container cleanup to avoid flicker:

		if (!inBatch) {
			delAllChildNodes(imgContainer);
		}

		imgContainer.appendChild(img);

	} catch (error) {
		console.log(error);
	}
}

async function saveImg(project, render, fileName) {
	try {
		render = await getOrCreateRender(project, render);
		saveDL(render.img.src, fileName || render.fileName, 'png');
	} catch (error) {
		console.log(error);
	}
}

//* Page-specific functions: UI-side *-----------------------------------------

function onProjectButtonClick(e) {
	if (
		!e
	||	e.type !== 'click'
	||	e.target.tagName.toLowerCase() !== 'button'
	) {
		return;
	}

var	container = getProjectContainer(e)
,	project = container.project
,	action = e.target.name
	;

	if (action === 'show') showImg(project); else
	if (action === 'save') saveImg(project); else
	if (action === 'show_all') showAll(project); else
	if (action === 'save_all') saveAll(project); else
	if (action === 'reset_to_init' ) setAllValues(project, -1); else
	if (action === 'reset_to_top'  ) setAllValues(project, 1); else
	if (action === 'reset_to_empty') setAllValues(project);
	else {
		console.log([e, container, project, 'Unknown action: ' + action]);
	}
}

function onProjectMenuUpdate(e, params) {
	if (
		!e
	||	e.type !== 'change'
	) {
		return;
	}

//* batch checkbox:

	if (params || (params = e.target.params)) {
		params.batch = !(params.preselect = !!e.target.checked);
	} else

//* select option:

	if (e.target.getAttribute('data-section')) {
	var	container = getProjectContainer(e)
	,	project = container.project
		;
		updateMenuAndRender(project);
	}
}

function onPageDragOver(e) {
	eventStop(e).preventDefault();

var	d = e.dataTransfer.files
,	i = d && d.length
	;
	e.dataTransfer.dropEffect = (i ? 'copy' : 'move');
}

async function onPageDrop(e) {
var	e = eventStop(e,0,1)
,	tryFiles = []
,	files, name, ext, projectRenderFallBack
	;

//* get list of files to process:

	for (var batch of [e.dataTransfer, e.target, e.value, e]) if (
		batch
	&&	(files = batch.files)
	&&	files.length
	) {
		for (var file of files) if (
			file
		&&	(name = file.name).length > 0
		&&	(ext = getFileExt(name)).length > 0
		) {
			tryFiles.push({
				evt: e
			,	file: file
			,	name: name
			,	ext: ext
			});
		}
	}

var	logLabel = 'Load project from event: ' + tryFiles.map(v => v.name).join(', ')
,	loadedProjectsCount = 0
	;

	console.time(logLabel);
	console.group(logLabel);

	for (var file of tryFiles) {
		if (await addProjectView(file)) {
			++loadedProjectsCount;
		}
	}

	console.groupEnd(logLabel);
	console.timeEnd(logLabel);

	if (!loadedProjectsCount) alert(
		la.error.file
	+	'\n'
	+	loadedProjectsCount
	+	' / '
	+	tryFiles.length
	);
}

async function loadFromURL(url) {
	if (!url) {
		return;
	}

var	name = getFileName(url)
,	ext = getFileExt(name)
,	logLabel = 'Load project from url: ' + url
	;

	console.time(logLabel);
	console.group(logLabel);

var	isProjectLoaded = await addProjectView(
		{
			url: url
		,	name: name
		,	ext: ext
		}
	);

	console.groupEnd(logLabel);
	console.timeEnd(logLabel);

	return isProjectLoaded;
}

async function loadFromButton(e, action) {
	if (e.disabled) {
		return;
	}

	e.disabled = true;

	if (action) {
	var	p = getParentByClass(e, regClassExampleFiles);

		if (action === 'download_all') {
		var	count = 0;

			for (var a of gt('a', p)) if (a.download) {
				a.click();

				if (++count >= 10) {
					await pause(1000);
					count = 0;
				}
			}
		} else
		if (action === 'load_all') {
			for (var b of gt('button', p)) if (b.getAttribute('data-url')) {
				await loadFromButton(b);
			}
		}
	} else {

//* show loading status:

	var	c = 'loading'
	,	p = getParentByClass(e, regClassExampleFile)
		;

		if (p && p.className) {
			if (p.className.indexOf(c) < 0) {
				toggleClass(p,c,1);
			} else {
				return;
			}
		}

//* process the file:

	var	url = e.getAttribute('data-url')
	,	isProjectLoaded = await loadFromURL(url)
		;

		if (!isProjectLoaded) alert(
			la.error.file
		+	'\n'
		+	url
		);

//* remove loading status:

		if (p && p.className) {
			toggleClass(p,c,-1);
		}
	}

	e.disabled = false;
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
	var	c = e.className;
		if (c && regClassShow.test(c)) {
		var	selectNext = e.nextElementSibling || e.previousElementSibling;
			selectProject(selectNext);
		}
		removeProjectView(e.id);
	}
}

//* Runtime: prepare UI *------------------------------------------------------

async function init() {
	await loadLib(
		'config.js',
		libDir + 'composition.asm.js',
	);

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
,	topMenuEntries = []
,	HTMLparts = {}
	;

	HTMLparts.file = (
		'<p>'
	+		la.menu.file.project
	+	'</p>'
	+	'<input type="file" onchange="onPageDrop(this)">'
	+	'<p>'
	+		la.menu.file.formats
	+		'\n'
	+		supportedFileTypesText
	+		'.'
	+	'</p>'
	);

	HTMLparts.examples = (
		exampleProjectFiles.map(
			v => {
			var	fileListHTML = (
					v.files.map(
						file => {
						var	fileName = (file.join ? file[0] : file)
						,	fileInfo = (
								file.join
							&&	file[1]
								? '(' + file[1] + ')'
								: ''
							)
						,	filePath = examplesDir + (v.dir || '') + fileName
						,	fileAttr = encodeTagAttr(fileName)
						,	pathAttr = encodeTagAttr(filePath)
						,	dict = la.menu.examples.buttons
						,	downloadLink = (
								'<a href="'
							+		pathAttr
							+	'" download="'
							+		fileAttr
							+	'">'
							+		dict.download
							+	'</a>'
							)
						,	loadButton = (
								'<button onclick="loadFromButton(this)" data-url="'
							+		pathAttr
							+	'">'
							+		dict.load
							+	'</button>'
							)
						,	tabs = [
								fileName
							,	fileInfo
							,	downloadLink
							,	loadButton
							];
							return (
								'<tr class="example-file">'
							+		'<td>'
							+		tabs.join('</td><td>')
							+		'</td>'
							+	'</tr>'
							);
						}
					).join('')
				)
			,	batchButtons = []
			,	dict = la.menu.examples.batch_buttons
				;

				for (var i in dict) {
					batchButtons.push(
						'<td colspan="2"><button onclick="loadFromButton(this, \''
					+		encodeTagAttr(i)
					+	'\')">'
					+		dict[i]
					+	'</button></td>'
					);
				}

				if (batchButtons.length > 0) {
					fileListHTML += (
						'<tr class="example-file">'
					+		batchButtons.join('')
					+	'</tr>'
					);
				}

				return (
					'<p>'
				+		'<header>'
				+			(la.menu.examples[v.example] || v.example)
				+			':'
				+		'</header>'
				+		'<table class="example-files">'
				+			fileListHTML
				+		'</table>'
				+	'</p>'
				);
			}
		).join('')
	);

	HTMLparts.help = (
		'<p>TODO</p>'
	);

	HTMLparts.about = (
		'<p>'
	+		'<a href="https://github.com/f2d/sprite_dress_up">'
	+			la.menu.about.source
	+		'</a>'
	+	'</p>'
	);

	for (var i in la.menu) {
		topMenuEntries.push([
			la.menu[i].header || 'TODO'
		,	HTMLparts[i] || 'TODO'
		]);
	}

var	topMenuHTML = (
		topMenuEntries
		.map(getDropdownMenuHTML)
		.join('')
	);

	document.body.innerHTML = (
		'<div class="menu-bar">'
	+		topMenuHTML
	+	'</div>'
	+	'<div id="loaded-files-selection"></div>'
	+	'<div id="loaded-files-view"></div>'
	);

//* drop event may not work without dragover:

var	a = {
		'dragover':	onPageDragOver
	,	'drop':		onPageDrop
	};
	for (var i in a) window.addEventListener(i, a[i], false);

	logTime('ready to work');
}

document.addEventListener('DOMContentLoaded', init, false);
