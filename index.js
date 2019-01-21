
//* source file data:
//* TODO: read PSD layer masks.
//* TODO: save as ORA.

//* menu:
//* TODO: progress/status panel + [stop operation] button.
//* TODO: buttons: show/save [all marked and visible options], [all marked], [all].
//* TODO: options menu: add/remove/copy colors and outlines, edit all list(s) at once in textarea - including all usable layer names, or only currently existing.
//* TODO: N px outline, select color and method:
//*	a) max alpha in +|- N px around,
//*	b) min distance to any non-transparent px (map the 0,N:N+1,+Inf range to 255:0).
//* TODO: zoom format in filenames: [x1, x1.00, x100%].

//* rendering:
//* TODO: arithmetic emulation of all blending operations, not native to JS.
//* TODO: arithmetic emulation of all operations in 16/32-bit until final result; to be optionally available as checkbox/selectbox.
//* TODO: decode layer data (PSD/PNG/etc) manually without using canvas, to avoid premultiplied-alpha (PMA - in Firefox, not in Chrome) while rendering.
//* TODO: img src: recompress using temporary canvas (bad with PMA), save whichever is shorter (original vs temp) as base64 or blob.

//* later when it works at all, try in spare time:
//* TODO: split functionality into modules to reuse with drawpad, etc.

//* Config *-------------------------------------------------------------------

var	regLayerNameToSkip		= /^(skip)$/i
,	regLayerNameParamOrComment	= /(?:^|[\s_]*)(?:\[([^\[\]]*)\]|\([^()]*\))(?:[\s_]*|$)/i
,	regLayerNameParamSplit		= /[\s,_]+/g
,	regLayerNameParamTrim		= /^[\s,_]+|[\s,_]+$/g

//* examples of comments: "... (1) ... (copy 2) (etc)"
//* examples of params: "... [param] ... [param,param param_param]"

//* TODO: make visible user manual from notes and examples.
//* TODO: keep all parameters single-word if possible.

,	regLayerNameParamType = {
		'skip':		/^(skip)$/i
	,	'none':		/^(none)$/i
	,	'if_only':	/^(if|in)$/i
	,	'not':		/^(\!|not?)$/i
	,	'any':		/^(\?|any|some)$/i

	,	'colors':	/^(colou?r)s$/i
	,	'parts':	/^(option|part|type)s$/i

	,	'paddings':	/^(outline|inline)([+-]edge|box)?$/i
	,	'radius':	/^(\d[x\d-]*)px$/i

	,	'opacities':	/^(\d[\d-]*)%(\d*)$/i
	,	'zoom':		/^x(\d[\d-]*)%(\d*)$/i

	,	'multi_select':	/^(?:x(\d[\d-]*)|optional)$/i
/*
examples of layer folder names with parameter syntax:

	"[if not any parts] body" (render contents of this folder if "parts: body" select box value is empty)
	"[if     any parts] body" (render contents of this folder if "parts: body" select box value is non-empty)
	"[if not colors]    hair" (render only those subfolders/layers, which are named not as the "colors: hair" select box value)
	"[if     colors]    hair" (render only those subfolders/layers, which are named same as the "colors: hair" select box value)

	Note: any amount of whitespace is ok.
	Note: [none] discards layer name for option ID, result equals empty name; may be used for clarity in logical sets.
	Note: [parts/colors] folder with [if/not/any] are intended for logical dependencies, and do not add options to selectable list.
	Note: [colors] folder without [if/not/any] gets replaced with selected color, or skipped if empty value is selected. Any layer inside it is added as option regardless of nesting depth, which is intended for logical dependencies and overwriting color value under same name.

examples of 'paddings', 'radius':

	[outline 1-2x3-4px]	(1 to 2 x 3 to 4 px radius, rectangle area around each pixel)
	[outline 2xpx]		(2 px radius, square area)
	[outline 1-4px]		(1 to 4 px radius, rounded area)

	Note: [outline]      fills a max-around-value mask behind all above it in the same folder.
	Note: [outline-edge] draws outline on outer side, inner areas and transparent holes are skipped.
	Note: [outline-box]  draws bounding rectangle edge.
	Note: [inline]       fills inside of min-around-value mask over all below it in the same folder.
	Note: [inline-edge]  fills outside of min-around-value mask, may be used with clipping group.
	Note: [inline-box]   fills bounding rectangle area.

examples of 'opacities':

	[100-50%]	(set opacity of this layer/folder to exactly 100 or 50%)
	[0-30-60-90%1]	(exactly 30, 60, 90%, or skip rendering at 0%, preselect format version 1)

examples of 'zoom':

	[x50-100-200%]	(scale to 50, 100 or 200%, default shortest format in filenames)
	[x100-50-25%2]	(scale to 100, 50 or 25%, preselect format version 2)

	Note: applied to whole result image, so if needed - put this on topmost root layer for clarity.
	Note: first one listed is shown by default.
	Note: 100% is rendered first regardless of selection, then scaled up/down repeatedly by up to x2, until target scale is met.
	Note: all intermediate results are cached and reused.

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
,	regLayerTypeSingleTrim	= /s+$/i
,	regNaN			= /\D+/g
,	regSpace		= /\s+/g
,	regTrim			= /^\s+|\s+$/g
,	regTrimNaN		= /^\D+|\D+$/g
,	regTrimNewLine		= /[^\S\r\n]*(\r\n|\r|\n)/g

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
,	NAME_PARTS_FOLDERS = ['parts', 'colors']
,	NAME_PARTS_ORDER = ['parts', 'colors', 'paddings', 'opacities', 'zoom']
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
,	project = {}
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

function getByPropChain() {
var	a = toArray(arguments)
,	o = a.shift()
	;
	while (o && a.length > 0) o = o[a.shift()];
	return o;
}

function toArray(a) {try {return TOS.slice.call(a);} catch (e) {return [];}}
function arrayFilterNonEmptyValues(v) {return !!v;}
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

function gc(n,p) {try {return toArray((p || document).getElementsByClassName	(n));} catch (e) {return [];}}
function gt(n,p) {try {return toArray((p || document).getElementsByTagName	(n));} catch (e) {return [];}}
function gn(n,p) {try {return toArray((p || document).getElementsByName	(n));} catch (e) {return [];}}
function gi(n,p) {try {return toArray((p || document).getElementsById		(n));} catch (e) {return [];}}
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

function getParentBeforeClass(e,c) {
var	p = e
,	r = (c.test ? c : getClassReg(c))
	;
	while (e && (e = e.parentNode) && !(e.className && r.test(e.className))) p = e;
	return p;
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

function getNumbersArray(t,n) {
var	a = (
		t
		.split(regNaN)
		.map(orz)
	);
	return (
		n && n > 0
		? a.slice(0, n)
		: a
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

function mergeDictOfArrays(old_dict, new_dict) {
var	i,k
,	new_item
,	new_arr
,	old_arr
	;
	for (k in new_dict) if (new_arr = new_dict[k]) {
		if (old_arr = old_dict[k]) {
			for (i in new_arr) if (new_item = new_arr[i]) {
				if (old_arr.indexOf(new_item) < 0) {
					old_arr.push(new_item);
				}
			}
		} else {
			old_dict[k] = new_arr.slice(0);
		}
	}
	return old_dict;
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
		,	scripts = lib.files || (lib.join ? lib : toArray(arguments))
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
,	scripts = (lib.files || []).slice()
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

function clearCanvasForGC(ctx) {
	if (!ctx) return;

var	canvas = ctx.canvas || ctx
,	t = canvas.tagName
	;

	if (!t || t.toLowerCase() !== 'canvas') return;

	canvas.width = 1;
	canvas.height = 1;

	// return canvas;
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

function addButton(text, func, parent) {
var	e = cre('button', parent);
	e.textContent = text || e.tagName;
	e.setAttribute('onclick', func || ('alert(' + e.textContent + ')'));
	return e;
}

function addOption(parent, text) {
var	e = cre('option', parent);
	e.textContent = e.value = text || '';
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

function getProperOpacity(a) {
	return Math.max(0, Math.min(1, orz(a) / MAX_OPACITY));
}

function getProperBlendMode(b) {
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

function getLayerParentOptions(layer) {
var	a,k,n,o = {};

	if (layer) do {
		if (k = layer.name) {
			if (n && layer.isOptionList) {
				a = (o[k] || (o[k] = []));
				if (a.indexOf(n) < 0) a.push(n);
			}
			n = k;
		}
	} while (layer = layer.parent);

	return o;
}

function getLayerPath(layer) {
var	n, path = [];

	while (layer = layer.parent) {
		if (n = layer.name) path.unshift(n);
	}

	return path;
}

function getParentLayer(layer) {
	while (layer = layer.parent) if (layer.params) break;
	return layer;
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

async function loadProject(sourceFile) {

	async function loadProjectOptions(projectWIP) {

		function getProjectOptions(projectWIP) {

			function processLayerInBranch(layer) {

				function getOrAddProjectOption(t,n,i,v) {
				var	t = ''+t
				,	n = ''+n
				,	o = (options || (options = {}))
				,	o = (o[t] || (o[t] = {}))
				,	o = (o[n] || (o[n] = {
						'params': {}
					,	'items': {}
					}))
					;
					if (i) {
						o = o.items;
						o = (o[i] || (o[i] = {
							'layer': v.layer
						,	'values': []
						,	'requires': {}
						,	'except': {}
						}));
						o.values.push(v);
					}
					return o;
				}

//* TODO: vary colors depending on layer path and logic, not just single first met layer.
//* TODO: fix inclusion/exclusion logic, multiple [not] in paths, etc.

				function addOptionRules(t,n,i,layer) {
				var	j = (
						!params.not === !(p ? p.params.not : false)
						? 'requires'
						: 'except'
					)
				,	rules = getLayerParentOptions(layer)
				,	a = getOrAddProjectOption(
						t,n,i
					,	{
							'layer': layer
						,	'rules': rules
						}
					);
					a[j] = mergeDictOfArrays(a[j], rules);
				}

				function checkBatchParams(globalOptionParams) {
					for (var k of [
						'batch',
						'preselect',
					]) if (params[k]) {
						if (!projectWIP.batch.paramNameDefault) {
							projectWIP.batch.paramNameMarked = k;
							projectWIP.batch.paramNameDefault = getOtherBatchParam(k);
						}
						globalOptionParams[k] = true;
					}
				}

				function addOptionGroup(layer) {
				var	t = layer.type
				,	g = getOrAddProjectOption(t,n).params
				,	j,k,o
					;
					checkBatchParams(g);

					if (j = params[k = 'multi_select']) {
						if (o = g[k]) {
							if (o.min > j.min) o.min = j.min;
							if (o.max < j.max) o.max = j.max;
						} else {
							o = g[k] = {};
							for (i in j) o[i] = j[i];
						}
					}

					for (k of [
						'last',
						'no_prefix',
					]) {
						if (params[k]) g[k] = true;
					}
				}

				function addOptionGroupItem(layer, p) {
				var	k = p.name
				,	t = p.type
					;
					addOptionRules(t,k,n,layer);

					layer.isOption = true;
					layer.type = t.replace(regLayerTypeSingleTrim, '');
				}

				function addOptionItemsFromParam(t, byLayerName) {
					if (j = params[t]) {
					var	o = getOrAddProjectOption(t, (byLayerName ? n : t))
					,	g = o.params
					,	a = o.items
						;
						checkBatchParams(g);

						if ((i = 'format') in j) g[i] = j[i];
						if ((i = 'values') in j) {
							j[i].map(v => {
								v += '%';	//* <- avoid autosorting of bare numbers in <select>
								if (byLayerName) addOptionRules(t,n,v,layer);
								else if (!(v in a)) a[v] = v;
							});
						}
					}
				}

			var	n = layer.name
			,	params = layer.params
			,	p = getParentLayer(layer)
			,	a,g,i,j,k,o,t
				;

				if (
					params.skip
				||	regLayerNameToSkip.test(n)
				) {
					return;
				}

				addOptionItemsFromParam('zoom');
				addOptionItemsFromParam('opacities', true);

				if (layer.isOptionList) addOptionGroup(layer); else
				if (p && p.isOptionList) addOptionGroupItem(layer, p);

				if (a = layer.layers) {
					layer.layers = getUnskippedProcessedLayers(a);
				} else
				if (layer.opacity > 0) {
					projectWIP.loading.images.push(layer);
				}

				return layer;
			}

			function isLayerSkipped(layer) {
				return (
					layer.params.skip
				||	regLayerNameToSkip.test(layer.name)
				);
			}

			function getUnskippedProcessedLayers(layers) {
			var	a = []
			,	i = layers.length
			,	skips = layers.map(isLayerSkipped)
			,	layer
				;

				while (i--) if (
					!skips[i]
				&&	(layer = layers[i])
				) {
					if (
						skips[i + 1]
					&&	layer.clipping
					) {
						skips[i] = true;
					} else {
						a.push(layer);
					}
				}
				a.reverse();

				return a.map(processLayerInBranch);
			}

		var	options, k;
			projectWIP.layers = getUnskippedProcessedLayers(projectWIP.layers);

			if (!projectWIP.batch.paramNameDefault) {
				projectWIP.batch.paramNameDefault = k = 'batch';
				projectWIP.batch.paramNameMarked = getOtherBatchParam(k);
			}

			return options;
		}

		function getLayerImgLoadPromise(layer) {
			return new Promise(
				(resolve, reject) => {
				var	img, onImgLoad = async function(e) {
						layer.img = await (
							layer.type === 'color'
							? getFirstPixelRGBA(img)
							: getImgOptimized(img)
						);

						resolve(true);
					}

					try {
						img = projectWIP.toPng(layer);
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

//* render default set when everything is ready:

		try {
		var	options = getProjectOptions(projectWIP);
			if (options) {
			var	result = true
			,	l_a = projectWIP.loading.images
			,	l_i = projectWIP.loading.imagesCount = l_a.length
				;

				logTime(l_i + ' images to preload.');

//* try loading one by one to avoid flood of errors:

				while (result && l_a.length > 0) {
					result = await getLayerImgLoadPromise(l_a.pop());
				}

				if (result) {
					logTime('"' + projectWIP.fileName + '" finished loading, took ' + (+new Date - projectWIP.loading.startTime) + ' ms');

					projectWIP.options = options;

					loadProjectFinalizeDisplayMenu(projectWIP);
				}
			} else {
				logTime('"' + projectWIP.fileName + '" finished loading, took ' + (+new Date - projectWIP.loading.startTime) + ' ms, options not found.');
			}
		} catch (error) {
			console.log(error);

			if (projectWIP.options) {
				projectWIP.options = null;
				delete projectWIP.options;
			}
		}

		return projectWIP;
	}

	function createProjectView(projectWIP, container) {
	var	sourceFile = projectWIP.loading.data.file || {}
	,	sourceFileTime = sourceFile.lastModified || sourceFile.lastModifiedDate
	,	container = delAllChildNodes(container || id('project-container'))
	,	header = cre('header', container)
		;
		header.id = 'project-header';

//* show overall project info:

	var	e = cre('section', header)
	,	h = cre('header', e)
		;
		h.id = 'project-name';
		h.textContent = projectWIP.fileName;

		if (projectWIP.channels && projectWIP.bitDepth) {
			t = projectWIP.channels + 'x' + projectWIP.bitDepth + ' ' + la.project.bits;
		} else
		if (projectWIP.channels) {
			t = projectWIP.channels + ' ' + la.project.channels;
		} else
		if (projectWIP.bitDepth) {
			t = projectWIP.bitDepth + ' ' + la.project.bits;
		} else t = '';

		t = [
			projectWIP.width + 'x'
		+	projectWIP.height + ' '
		+	la.project.pixels

		,	[
				(projectWIP.colorMode || '')
			,	t
			]
			.filter(arrayFilterNonEmptyValues)
			.join(' ')
		];

	var	i = projectWIP.loading.imagesCount
	,	j = projectWIP.layersCount
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

	var	b = la.buttons
	,	f = la.render.from
	,	e = cre('section', header)
	,	h = cre('header', e)
	,	g = cre('footer', e)
		;
		h.textContent = f.current + ':';

		addButton(b.show, 'showImg()', g);
		addButton(b.save, 'saveImg()', g);
		addButton(b.reset_to_empty, 'setAllEmptyValues()', g);

	var	e = cre('section', header)
	,	h = cre('header', e)
		;
		h.textContent = f.batch + ': ';
		cre('span', h).id = 'batch-count';

	var	b = la.render.if
	,	f = la.render.selection
	,	t = 'radio'
	,	v = 'any'
	,	m = (projectWIP.batch.paramNameDefault !== 'batch' ? 'yes' : 'no')
	,	i,j,k,n
	,	table, tr, td
		;
		if (TESTING && (table = cre('table', cre('div', e))))
		for (i in f) {
			tr = cre('tr', table);
			td = cre('td', tr);
			td.textContent = f[i] + ':';
			k = 'batch-select-' + i;

			for (j in b) {
				td = cre('td', tr);
				n = cre('label', td);
				n.textContent = b[j];

				n = cre('input', n, n.lastChild);
				n.type = t;
				n.name = k;
				n.value = j;
				n.onchange = updateBatchOptions;
				if (
					(i == 'visible' && j == v)
				||	(i == 'marked'  && j == m)
				) {
					n.checked = true;
					projectWIP.batch[i] = j;
				}
			}
		}

		b = la.buttons;
		g = cre('footer', e);
		addButton(b.show_all, 'showAll()', g);
		addButton(b.save_all, 'saveAll()', g);

//* project parser testing:

		if (TESTING) {
			e = cre('p', container);
			e.style.backgroundColor = 'red';

			addButton('save data JSON', 'saveDL(project.sourceData, "data", "json", 1, replaceJSONpartsFromPSD)', e);
			addButton('save tree JSON', 'saveDL(project.layers, "tree", "json", 1, replaceJSONpartsFromTree)', e);
			addButton('save project JSON', 'saveDL(project, "project", "json", 1, replaceJSONpartsFromPSD)', e);
		}

//* place for results:

		tr = cre('tr', cre('table', container));
		cre('td', tr).id = 'project-options';
		cre('td', tr).id = 'render';
	}

	function createOptionsMenu(options, container) {

		function getBatchCheckboxUpdateFunc(params) {
			return function(e) {
				params.batch = !(params.preselect = !!e.target.checked);
			}
		}

	var	container = delAllChildNodes(container || id('project-options'))
	,	sections = la.options.sections
	,	section
	,	optionList
	,	b = projectWIP.batch.paramNameDefault
	,	c = projectWIP.batch.paramNameMarked
		;

//* section = type of use (fill colors, draw parts):

		for (var sectionName in sections) if (section = options[sectionName]) {
		var	sectionBox = cre('section', container);
			sectionBox.textContent = sections[sectionName] + ':';

//* list box = set of parts:

			for (var listName in section) if (optionList = section[listName]) {
			var	items = optionList.items
			,	params = optionList.params
			,	hasEmptyOption = false
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
				i.addEventListener('change', getBatchCheckboxUpdateFunc(params), false);

			var	s = cre('select', optionBox);
				s.name = listName;
				s.title = JSON.stringify(params);
				s.setAttribute('data-section', sectionName);
				s.addEventListener('change', updateMenuAndRender, false);

//* list item = each part:

				for (var optionName in items) {
				var	n = optionName || '?';
					if (n == '0%') {
						n = '';
						hasEmptyOption = true;
					}
					addOption(s, n);
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
			}
		}
	}

	function loadProjectFinalizeDisplayMenu(projectWIP) {
		createProjectView(projectWIP);
		createOptionsMenu(projectWIP.options);

		['loading', 'toPng', 'sourceData'].map(
			v => {
				projectWIP[v] = null;
				delete projectWIP[v];
			}
		);

		project = projectWIP;

		updateMenuAndRender();
	}

var	n = sourceFile.name
,	i = n.lastIndexOf('.')
,	b = (i < 0 ? n : n.substr(0, i))
,	ext = sourceFile.ext || getFileExt(n)
	;
	logTime('"' + n + '" started loading');

	for (var ftl of fileTypeLoaders) if (ftl.dropFileExts.indexOf(ext) >= 0)
	for (var fileParserFunc of ftl.handlerFuncs) {
		try {
		var	projectWIP = {
				fileName: n
			,	baseName: b
			,	batch: {}
			,	loading: {
					startTime: +new Date
				,	then: loadProjectOptions
				,	data: sourceFile
				,	images: []
				}
			}
		,	result = await fileParserFunc(projectWIP)
			;
			if (result) {
				// console.log(['projectWIP', projectWIP]);

				return projectWIP;
			}
		} catch (error) {
			console.log(error);
		}
	}

	return null;
}

function loadProjectFinalizeDisplayFallBack(projectWIP) {
var	e,i;
	if (e = id('project-container')) {
		delAllChildNodes(e).textContent = la.error.project;

		if (i = projectWIP.toPng()) {
			cre('br', e);
			e.appendChild(i);
		}
	}
	if (e = id('project-options')) delAllChildNodes(e);
}

function getNextParentAfterAddingLayerToTree(layer, sourceData, name, parentGroup, isLayerFolder) {
var	m,v
,	paramList = []
,	params = {}
	;
	layer.sourceData = sourceData;
	layer.nameOriginal = name = trim(name);

	while (m = name.match(regLayerNameParamOrComment)) {
		if (
			(m = m[1])
		&&	(m.length > 0)
		) {
			m
			.split(regLayerNameParamSplit)
			.map(trimParam)
			.filter(arrayFilterNonEmptyValues)
			.map(v => paramList.push(v));
		}
		name = trim(name.replace(regLayerNameParamOrComment, ''));
	}

	if (paramList.length > 0) {
		paramList = paramList.filter(arrayFilterUniqueValues);
		paramList.sort();

		for (var param of paramList) {
			for (var k in regLayerNameParamType) if (
				!(k in params)
			&&	(m = param.match(regLayerNameParamType[k]))
			) {
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
					,	'form': m[2]	//* <- edge|box|default
					};
				} else
				if (k === 'radius') {
					v = getNumbersArray(m[1], 2);
					params[k] = {
						'x': Math.max(1, v[0])
					,	'y': Math.max(1, v[v.length > 1?1:0])
					,	'form': (m[1].indexOf('x') < 0 ? 'round' : 'box')
					};
				} else
				if (k === 'multi_select') {
					v = (
						m[1] == 'optional'
						? [0,1]
						: getNumbersArray(m[1], 2)
					);
					params[k] = {
						'min': Math.max(0, v[0])
					,	'max': Math.max(1, v[v.length > 1?1:0])
					};
				} else {
					if (k == 'preselect' && param.indexOf('last') >= 0) params.last = true;
					params[k] = k;
				}
			}
		}
		if (k = layer.type) {
			if (params.any) {
				layer.isOptionIf = true;
			} else
			if (NAME_PARTS_FOLDERS.indexOf(k) >= 0) {
				layer.isOptionList = true;
			}
		}
	}

	layer.name = name;
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

async function loadCommonWrapper(projectWIP, libName, fileParserFunc, treeConstructorFunc) {
	if (!(await loadLibOnDemand(libName))) return;

	logTime('"' + projectWIP.fileName + '" started parsing with ' + libName);

	projectWIP.loading.startParsingTime = +new Date;

	try {
	var	d = projectWIP.loading.data
	,	sourceData = await fileParserFunc(
			d.url
			? (d.file = await readFilePromiseFromURL(d.url, 'blob'))
			: d.file
		);

		logTime('"' + projectWIP.fileName + '" finished parsing, took ' + (+new Date - projectWIP.loading.startParsingTime) + ' ms');
	} catch (error) {
		console.log(error);

		logTime('"' + projectWIP.fileName + '" failed parsing after ' + (+new Date - projectWIP.loading.startParsingTime) + ' ms');
	}

	if (sourceData) {
		projectWIP.sourceData	= sourceData;
		projectWIP.toPng	= thisToPng;

		if (treeConstructorFunc(projectWIP, sourceData)) {
			return await projectWIP.loading.then(projectWIP);
		}
	}
}

async function loadORA(projectWIP) {
	return await loadCommonWrapper(
		projectWIP
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
	,	function treeConstructorFunc(projectWIP, sourceData) {
			if (!sourceData.layers) return;

		var	l_i = projectWIP.layersCount = (
				(sourceData.layersCount || 0)
			+	(sourceData.stacksCount || 0)
			);

			if (!l_i) return;

			projectWIP.width	= sourceData.width;
			projectWIP.height	= sourceData.height;

//* gather layers into a tree object:

			function addLayerToTree(layer, parentGroup) {
			var	n = layer.name || ''
			,	layers = layer.layers || null
			,	isLayerFolder = (layers && layers.length > 0)
			,	parentGroup = getNextParentAfterAddingLayerToTree(
					{
						top:    orz(layer.top  || layer.x)
					,	left:   orz(layer.left || layer.x)
					,	width:  orz(layer.width)
					,	height: orz(layer.height)
					,	clipping:  getTruthyValue(layer.clipping)
					,	opacity:   orzFloat(layer.opacity)
					,	blendMode: getProperBlendMode(layer.composite)
					}
				,	layer
				,	n
				,	parentGroup
				,	isLayerFolder
				);
				if (isLayerFolder) layers.map(v => addLayerToTree(v, parentGroup));
			}

//* note: layer masks are emulated via compositing modes in ORA

		var	parentGroup = projectWIP.layers = [];

			sourceData.layers.map(v => addLayerToTree(v, parentGroup));

			return true;
		}
	);
}

async function loadPSD       (projectWIP) {return await loadPSDCommonWrapper(projectWIP, 'psd.js', 'PSD_JS');}
async function loadPSDBrowser(projectWIP) {return await loadPSDCommonWrapper(projectWIP, 'psd.browser.js', 'PSD');}

async function loadPSDCommonWrapper(projectWIP, libName, varName) {
	return await loadCommonWrapper(
		projectWIP
	,	libName
	,	async function fileParserFunc(file) {
			return await window[varName].fromDroppedFile(file);
		}
	,	function treeConstructorFunc(projectWIP, sourceData) {
			if (!sourceData.layers) return;

		var	l_i = projectWIP.layersCount = sourceData.layers.length;

			if (!l_i) return;

		var	m = sourceData.header.mode;

			projectWIP.width	= sourceData.header.cols;
			projectWIP.height	= sourceData.header.rows;
			projectWIP.colorMode	= (isNaN(m) ? m : PSD_COLOR_MODES[m]);
			projectWIP.channels	= sourceData.header.channels;
			projectWIP.bitDepth	= sourceData.header.depth;

//* gather layers into a tree object:

			function addLayerToTree(layer, parentGroup) {
			var	l = layer.layer || layer
			,	i = layer.image || l.image
			,	m = layer.mask  || l.mask
			,	mask = null

//* "fill" opacity is used by SAI2 instead of usual one for layers with certain blending modes when exporting to PSD.
//* source: https://github.com/meltingice/psd.js/issues/153#issuecomment-436456896

			,	fillOpacity = (
					l.fillOpacity
					? getProperOpacity(l.fillOpacity().layer.adjustments.fillOpacity.obj.value)
					: 1
				)
			,	passThru = getByPropChain(l, 'adjustments', 'sectionDivider', 'obj', 'blendMode')
				;

				if (!regLayerBlendModePass.test(passThru)) {
					passThru = null;
				}

				/*
				if (
					m && !m.disabled
				&&	i && i.hasMask
				&&	(m = {
						top:    orz(m.top)
					,	left:   orz(m.left)
					,	width:  orz(m.width)
					,	height: orz(m.height)
					,	color:  m.defaultColor
					,	data:   i.maskData
					})
				&&	m.data.length > 0
				) {
					mask = m;
				}
				*/

			var	m = layer.blendMode || l.blendMode || {}
			,	n = layer.name || l.name || ''
			,	layers = layer.hasChildren() ? layer.children() : null
			,	isLayerFolder = (layers && layers.length > 0)
			,	parentGroup = getNextParentAfterAddingLayerToTree(
					{
						top:    orz(l.top)
					,	left:   orz(l.left)
					,	width:  orz(l.width)
					,	height: orz(l.height)
					,	clipping:  getTruthyValue(layer.clipped || m.clipped || m.clipping)
					,	opacity:   getProperOpacity(l.opacity) * fillOpacity
					,	blendMode: getProperBlendMode(passThru || m.mode || m)
					,	blendModeOriginal: (m.mode || m)
					// ,	mask:      mask
					}
				,	layer
				,	n
				,	parentGroup
				,	isLayerFolder
				);
				if (isLayerFolder) layers.map(v => addLayerToTree(v, parentGroup));
			}

		var	parentGroup = projectWIP.layers = [];

			sourceData.tree().children().map(v => addLayerToTree(v, parentGroup));

			return true;
		}
	);
}

async function loadPSDLIB(projectWIP) {
	return await loadCommonWrapper(
		projectWIP
	,	'PSDLIB.js'
	,	async function fileParserFunc(file) {
			return PSDLIB.parse(file);
		}
	,	function treeConstructorFunc(projectWIP, sourceData) {
			if (!sourceData.layers) return;

		var	l_a = sourceData.layers
		,	l_i = projectWIP.layersCount = l_a.length
			;

			if (!l_i) return;

			projectWIP.width	= sourceData.width;
			projectWIP.height	= sourceData.height;
			projectWIP.colorMode	= sourceData.colormode;
			projectWIP.channels	= sourceData.channels;
			projectWIP.bitDepth	= sourceData.depth;

//* gather layers into a tree object:

		var	parentGroup = projectWIP.layers = []
		,	layer
		,	d,k,n,t
			;
			while (l_i--) if (layer = l_a[l_i]) {
				n = layer.name || '';
				if (regPSD.layerNameEndOfFolder.test(n)) {
					while (
						(parentGroup = parentGroup.parent || projectWIP.layers)
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

					parentGroup = getNextParentAfterAddingLayerToTree(
						{
							top:    orz(layer.top)
						,	left:   orz(layer.left)
						,	width:  orz(layer.width)
						,	height: orz(layer.height)
						,	clipping:  getTruthyValue(layer.clipping)
						,	opacity:   getProperOpacity(layer.opacity)
						,	blendMode: getProperBlendMode(layer.blendMode)
						}
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

function isOptionRelevant(values, sectionName, listName, optionName) {

	function isOptionNotRelevant(rules, values, listName, inclusionRules) {
		for (var rListName in rules) {
			if (rListName === listName) continue;

		var	selectedValue = values[sectionName][rListName]
		,	rNames
			;
			if (
				inclusionRules ? (
					!selectedValue || (
						(rNames = rules[rListName])
					&&	rNames.indexOf(selectedValue) < 0
					)
				) : (
					selectedValue || (
						(rNames = rules[rListName])
					&&	rNames.indexOf(selectedValue) >= 0
					)
				)
			) {
				return true;
			}
		}
		return false;
	}

	if (optionName) {
	var	items = project.options[sectionName][listName].items;
		if (optionName in items) {
		var	i = items[optionName]
		,	rIncludeIfAll = i.requires
		,	rExcludeIfAny = i.except
			;
			return !(
				isOptionNotRelevant(rExcludeIfAny, values, listName)
			||	isOptionNotRelevant(rIncludeIfAll, values, listName, true)
			);
		}
		return false;
	}
	return true;
}

function isSetOfValuesOK(values) {
var	section, optionList;
	for (var sectionName in values) if (section = values[sectionName])
	for (var listName in section) if (optionName = section[listName]) {
		if (!isOptionRelevant(values, sectionName, listName, optionName)) {
			return false;
		}
	}
	return true;
}

function setAllEmptyValues() {
	gt('select', id('project-options')).map(
		s => {
			for (o of s.options) if (o.value === '') {
				s.value = '';
				return;
			}
		}
	);

	showImg();
}

function getAllMenuValues(checkPreselected) {
var	values = {};

	gt('select', id('project-options')).map(
		s => {
		var	sectionName = s.getAttribute('data-section')
		,	listName    = s.name
		,	params      = project.options[sectionName][listName].params
		,	optionLists = (values[sectionName] || (values[sectionName] = {}))
		,	b = (
				checkPreselected
			&&	params.preselect
			)
		,	o = optionLists[listName] = (
				b
				? [s.value]
				: gt('option', s).map(o => o.value)
			);
		}
	);

	return values;
}

function getAllValueSets(checkPreselected) {

	function getDeeper(optionLists, partialValueSet) {
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
			)
			;
			for (var i in optionNames) {

//* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#Deep_Clone

			var	values = JSON.parse(JSON.stringify(partialValueSet || {}))
			,	section = (values[sectionName] || (values[sectionName] = {}))
			,	optionName = optionNames[i]
				;
				section[listName] = optionName;

				if (optionsLeft) {
					getDeeper(optionsLeft, values);
				} else
				if (isSetOfValuesOK(values)) {
				var	fileName = getFileNameByValuesToSave(values);

					if (!(fileName in resultSets)) {
						resultSets[fileName] = values;
					}
				}
			}
		}
	}

var	values = getAllMenuValues(checkPreselected)
,	resultSets = {}
,	optionLists = []
,	section
,	sectionName
,	optionList
,	listName
	;

	for (var sectionName in values) if (section = values[sectionName])
	for (var listName in section) if (optionList = section[listName]) {
		optionLists.push({
			'sectionName': sectionName
		,	'listName'   : listName
		,	'optionNames': optionList
		});
	}

	getDeeper(optionLists);

	return resultSets;
}

function getMenuValues(updatedValues) {
var	values = {};

	gt('select', id('project-options')).map(
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
				gt('option', s).map(
					o => {
					var	optionName = o.value
					,	hide = !isOptionRelevant(updatedValues, sectionName, listName, optionName)
						;
						if (hide) {
							if (optionName == selectedValue) {
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
						if (!o.hidden !== !hide) {
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
			if (
				!hide
			&&	trim(listName = s.name).length > 0
			&&	trim(selectedValue = s.value).length > 0
			) {
				section[listName] = selectedValue;
			}
		}
	);

	return (
		updatedValues
		? values
		: getMenuValues(values)
	);
}

function drawImageOrColor(ctx, img, x,y, blendMode, opacity) {

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

		function getOrCreateReusableHeap() {
		var	buffer = project.renderingBuffer;

			if (!buffer) {
			var	realSize = project.width * project.height * 4 * 2
			,	paddedSize = nextValidHeapSize(realSize)
			,	buffer = project.renderingBuffer = new ArrayBuffer(paddedSize)
				;
			}

			return new Uint8Array(buffer);
		}

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
			,	uint8array = getOrCreateReusableHeap()
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

	if (opacity <= 0) return ctx.canvas;

	ctx.globalCompositeOperation = blendMode;

var	canvas = ctx.canvas
,	x = orz(x)
,	y = orz(y)
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

	return canvas;
}

function getMaskAndStripSourceAlpha(ctx, x,y, w,h) {
	project.rendering.layersBatchCount++;

var	canvas = cre('canvas')
,	w = canvas.width  = orz(w || ctx.canvas.width)
,	h = canvas.height = orz(h || ctx.canvas.height)
,	x = canvas.left   = orz(x)
,	y = canvas.top    = orz(y)
,	img = ctx.getImageData(x,y, w,h)
,	d = img.data
,	i = d.length
	;
	canvas.getContext('2d').putImageData(img, 0,0);

	while (i) d[i|3] = 255, i -= 4;

	ctx.putImageData(img, x,y);

	return canvas;
}

function getImageDataBlended(img, mask, mode, maskOpacity) {
	project.rendering.layersBatchCount++;

var	canvas = cre('canvas')
,	ctx = canvas.getContext('2d')
,	w = canvas.width  = (img ? img.width  : 0) || project.width
,	h = canvas.height = (img ? img.height : 0) || project.height
	;
	drawImageOrColor(ctx, img);

var	x = (mask ? orz(mask.top ) : 0) - (img ? orz(img.top ) : 0)
,	y = (mask ? orz(mask.left) : 0) - (img ? orz(img.left) : 0)
	;
	drawImageOrColor(ctx, mask, x,y, mode || BLEND_MODE_CLIP, maskOpacity);

	return canvas;
}

function getImageDataColored(optionName, selectedColors, img) {
	if (
		(o = project)
	&&	(o = o.options)
	&&	(o = o.colors)
	) {
	var	optionalColors = o
	,	selectedColors = selectedColors || optionalColors
		;
		if (
			(optionName in optionalColors)
		&&	(optionName in selectedColors)
		) {
		var	t,o = optionalColors[optionName].items[selectedColors[optionName]];
			if (o) {
				while (t = o.color || o.img || o.layer) o = t;
				img = getImageDataBlended(
					(img || o)
				,	(img ? o : null)
				);
			}
		}

	}

	return img;
}

function getRenderByValues(values, layersBatch, clippingGroupWIP) {

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
		};
	} else
	if (layersBatch) {
		project.rendering.layersBatchCount++;
	}

var	canvas = cre('canvas');
	if (canvas.getContext) {
	var	ctx = canvas.getContext('2d')
	,	w = canvas.width  = project.width
	,	h = canvas.height = project.height
	,	l_a = layersBatch || project.layers
	,	l_i = l_a.length
	,	l_k = l_i
	,	l_bottom = l_a[l_i - 1]
	,	l_clipping_mask
	,	colors = values.colors || {}
	,	parts = values.parts || {}
	,	layer
	,	i,j,k,l,m,n,o,p,t
		;

		while (l_i-- > 0) if (layer = l_a[l_i]) {
		var	params = layer.params
		,	n = layer.name
		,	t = layer.type
		,	x = layer.left
		,	y = layer.top
		,	skipColoring = !!layer.isOptionIf
		,	clippingGroupResult = false
			;

//* render clipping group as separate batch:

			if (!clippingGroupWIP) {
			var	g_a = [layer]
			,	g_i = l_i
			,	g_l
				;
				while (
					(g_i-- > 0)
				&&	(g_l = l_a[g_i])
				&&	g_l.clipping
				) {
					g_a.push(g_l);
				}

			var	g_k = g_a.length
				;
				if (g_k > 1) {
					if (g_k < l_k) {
						l_i = g_i + 1;
						clippingGroupResult = true;
					} else {
						clippingGroupWIP = true;
					}
				}
			}

//* skip not selected parts:

			if (
				layer.isOptionList
			||	layer.isOptionIf
			) {
				if (!params.not === !values[t][n]) {
					continue;
				}
			}

			if (layer.isOption) {
				if (
					(p = getParentLayer(layer))
				&&	(n !== values[p.type][p.name]) === (!params.not === !p.params.not)
				) {
					continue;
				}
			}

//* skip fully transparent:

			if (layer.opacity <= 0) {
				continue;
			}

//* skip by explicit name or param:

			if (
				params.skip
			||	regLayerNameToSkip.test(n)
			) {
				continue;
			}

//* get layer/folder/batch as flat image:

			i = null;

			if (clippingGroupResult) {
				i = getRenderByValues(values, g_a.reverse(), true);
			} else {
				if (j = layer.layers) {
					if (j.length > 0) {
						if (
							t === 'colors'
						&&	!params.if_only
						) {
							skipColoring = true;
							i = getImageDataColored(n, colors);
						} else
						if (layer.blendMode == 'pass') {
							l_a = l_a.slice(0, l_i).concat(j);
							l_i = l_a.length;

							continue;
						} else {
							i = getRenderByValues(values, j);
						}
					}
				} else {
					i = layer.img;
				}
			}

			if (i) {
				if (clippingGroupResult) {
					x = y = 0;
				} else {

//* apply color:

					if (!skipColoring) {
						i.left = x;
						i.top  = y;
						i = getImageDataColored(n, colors, i);
					}
				}

//* add content to current buffer canvas:

				drawImageOrColor(ctx, i, x,y, layer.blendMode, layer.opacity);

				k = ++project.rendering.layersApplyCount;

//* store the mask of the clipping group:

				if (
					clippingGroupWIP
				&&	layer === l_bottom
				) {
					l_clipping_mask = getMaskAndStripSourceAlpha(ctx, x,y, i.width, i.height);
				}

				clearCanvasForGC(i);
			}
		}

//* apply stored mask to the blended clipping group content:

		if (i = l_clipping_mask) {
			drawImageOrColor(ctx, i, i.left, i.top, BLEND_MODE_MASK);

			clearCanvasForGC(i);
		}

//* end of layer batch:

		if (!layersBatch) {
			logTime(
				'rendered in '
			+	[	project.rendering.layersBatchCount + ' canvas elements'
				,	project.rendering.layersApplyCount + ' blending steps'
				,	(+new Date - project.rendering.startTime) + ' ms'
				,	'subtitle'
				].join(', ')
			,	getFileNameByValues(values)
			);

			project.rendering = null;
		}

		return canvas;
	}
}

function getFileNameByValues(values, checkPreselected, skipDefaultPercent) {
	return (
		NAME_PARTS_ORDER
		.map(
			function(sectionName) {
			var	section = values[sectionName]
			,	resultNameParts = []
				;
				if (section) {
				var	listName
				,	optionName
				,	params
				,	a = Object.keys(section)
					;
					a.sort();
					for (var i = 0, k = a.length; i < k; i++) if (
						(listName   = a[i]             ).length > 0
					&&	(optionName = section[listName]).length > 0
					) {
						if (params = project.options[sectionName][listName].params) {
							if (checkPreselected) {
								if (
									params.preselect
								||	!params.batch
								) {
									continue;
								}
							}

							if (skipDefaultPercent) {
								if (
									(sectionName == 'zoom'      && orz(optionName) == 100)
								||	(sectionName == 'opacities' && orz(optionName) == 0)
								) {
									continue;
								}
							}

							if (
								fileNameAddParamKey
							&&	!params.no_prefix
							) {
								optionName = listName + '=' + optionName;
							}
						}

						resultNameParts.push(optionName);
					}
				}
				return (
					resultNameParts
					.filter(arrayFilterNonEmptyValues)
					.join('_')
				);
			}
		)
		.filter(arrayFilterNonEmptyValues)
		.join('_')
	);
}

function getFileNameByValuesToSave(values, checkPreselected, skipDefaultPercent) {
	return (
		[
			project.baseName
		,	getFileNameByValues(values || getMenuValues(), checkPreselected, skipDefaultPercent)
		]
		.filter(arrayFilterNonEmptyValues)
		.join('_')
	);
}

async function getOrCreateRender(render) {
	if (!render) render = {};
var	values   = render.values   || (render.values   = getMenuValues())
,	refName  = render.refName  || (render.refName  = getFileNameByValuesToSave(JSON.parse(JSON.stringify(values, replaceJSONpartsFromNameToCache))))
,	fileName = render.fileName || (render.fileName = getFileNameByValuesToSave(values))
,	img      = render.img      || (render.img      = await getOrCreateRenderedImg(render))
	;

	// console.log([refName, fileName, values, img]);

	return render;
}

async function getOrCreateRenderedImg(render) {

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

	if (!render) render = await getOrCreateRender();

	if (img = render.img) return img;

var	prerenders = (project.renders || (project.renders = {}))
,	fileName   = render.fileName
,	refName    = render.refName
,	values     = render.values
	;

	if (img = prerenders[fileName]) return img;

var	img = prerenders[refName] || await getAndCacheRenderedImgElement(getRenderByValues(values), refName)
,	z = values.zoom
	;

	if (img && z) {
		while (x = z.zoom) z = x;

		z = orz(z);

		if (
			z > 0
		&&	z != 100
		) {
		var	x = z / 100
		,	canvas = cre('canvas')
		,	w = canvas.width  = Math.max(1, Math.round(x * project.width))
		,	h = canvas.height = Math.max(1, Math.round(x * project.height))
		,	ctx = canvas.getContext('2d')
			;
			ctx.drawImage(img, 0,0, w,h);

			img = await getAndCacheRenderedImgElement(canvas, fileName, w,h);
		}
	}

	return img;
}

function updateBatchOptions(e,n) {
	if (
		e
	&&	(e = e.target)
	&&	(n = e.name)
	) {
		project.batch[n.split('-').pop()] = e.value;
	}
}

function updateMenuAndRender() {

	if (project.loading) {
		logTime('updateMenuAndRender - skipped while loading project.');
		return;
	}

	showImg();
}

async function renderAll(saveToFile, showOnPage) {
	if (!(saveToFile || showOnPage)) return;

var	logLabel = 'Render all: ' + project.fileName;

	console.time(logLabel);
	console.group(logLabel);

var	sets = getAllValueSets(true)
,	setsCountWithoutPause = 0
,	setsCount = 0
,	totalTime = 0
,	container = (showOnPage ? delAllChildNodes(id('render-all') || id('render')) : null)
,	lastPauseTime = +new Date
	;
	for (var fileName in sets) if (values = sets[fileName]) {
	var	startTime = +new Date
	,	render = await getOrCreateRender(
			{
				'values': values
			,	'fileName': fileName
			}
		);
		if (saveToFile) await saveImg(render, getFileNameByValuesToSave(values, true, true));
		if (showOnPage) await showImg(render, container);

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
	var	data = Uint8Array.from(TOS.map.call(data, v => v.charCodeAt(0)))
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

//* Page-specific functions: UI-side *-----------------------------------------

function saveAll() {renderAll(1,0);}
function showAll() {renderAll(0,1);}

async function showImg(render, container) {

//* prepare before container cleanup to avoid flicker:

var	img = await getOrCreateRenderedImg(render)
,	parent = container || delAllChildNodes(id('render'))
	;
	parent.appendChild(img);
}

async function saveImg(render, fileName) {
	render = await getOrCreateRender(render);

	saveDL(render.img.src, fileName || render.fileName, 'png');
}

function onPageDragOver(e) {
	eventStop(e).preventDefault();

var	d = e.dataTransfer.files
,	i = d && d.length
	;
	e.dataTransfer.dropEffect = (i ? 'copy' : 'move');
}

async function onPageDrop(e) {
	if (!window.FileReader) return;

var	e = eventStop(e,0,1)
,	tryFiles = []
,	files, name, ext, projectRenderFallBack
	;

	for (var batch of [e.dataTransfer, e.target]) if (
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

var	logLabel = 'Load project from event: ' + tryFiles.map(v => v.name).join(', ');

	console.time(logLabel);
	console.group(logLabel);

	for (var file of tryFiles) {
	var	projectWIP = await loadProject(file);

		if (projectWIP) {
			if (projectWIP.options) break;
			if (!projectRenderFallBack) projectRenderFallBack = projectWIP;
		}
	}

	if (!projectWIP) alert(la.error.file + ' / ' + tryFiles.length);
	if (projectRenderFallBack) loadProjectFinalizeDisplayFallBack(projectRenderFallBack);

	console.groupEnd(logLabel);
	console.timeEnd(logLabel);
}

async function loadFromURL(e, url) {

//* show loading status:

	e.disabled = true;
var	p = getParentBeforeClass(e, 'file').parentNode
,	c = 'loading'
	;
	if (p && p.className) {
		if (p.className.indexOf(c) < 0) {
			toggleClass(p,c,1);
		} else return;
	}

//* start the job:

var	name = getFileName(url)
,	ext = getFileExt(name)
,	logLabel = 'Load project from url: ' + url
	;
	console.time(logLabel);
	console.group(logLabel);

var	projectWIP = await loadProject(
		{
			url: url
		,	name: name
		,	ext: ext
		}
	);

//* remove loading status:

	if (p && p.className) {
		toggleClass(p,c,-1);
	}
	e.disabled = false;

//* finish the job:

	if (!projectWIP) alert(la.error.file + ' : ' + url); else
	if (!projectWIP.options) loadProjectFinalizeDisplayFallBack(projectWIP);

	console.groupEnd(logLabel);
	console.timeEnd(logLabel);
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

var	container = delAllChildNodes(document.body)
,	s = cre('section', container)
,	a,e,i
	;

	e = cre('div', s);
	e.id = 'loader';

	cre('p', e).textContent = la.hint.project;

	i = cre('input', cre('p', e));
	i.type = 'file';
	i.onchange = onPageDrop;

	a = (
		fileTypeLoaders
		.reduce(
			function(result, v,i,a) {
				return result.concat(v.dropFileExts);
			}
		,	[]
		)
		.filter(arrayFilterUniqueValues)
		.filter(arrayFilterNonEmptyValues)
		.map(v => v.toUpperCase())
		.sort()
		.join(', ')
	);

	cre('p', e).textContent = (
		la.hint.formats
	+	'\n' + a + '.'
	);

	if (
		exampleProjectFiles
	&&	exampleProjectFiles.length > 0
	) {
		e = cre('div', s);
		e.id = 'examples';

		cre('p', e).textContent = la.example.common;

		exampleProjectFiles.map(
			v => {
				cre('p', e).innerHTML = (
					'<header>'
				+		(la.example[v.example] || v.example)
				+		':'
				+	'</header>'
				+	'<div class="files">'
				+		'<table>'
				+	v.files.map(
						file => {
						var	fileName = (file.join ? file[0] : file)
						,	comment  = (file.join ? file[1] : '')
						,	filePath = examplesDir + (v.dir || '') + fileName
						,	fileAttr = encodeTagAttr(fileName)
						,	pathAttr = encodeTagAttr(filePath)
							;
							return (
								'<tr class="file"><td>'
							+	[
									fileName
								// +	':'

								,	(comment ? '(' + comment + ')' : '')

								,	'<a href="'
								+		pathAttr
								+	'" download="'
								+		fileAttr
								+	'">'
								+		la.buttons.download
								+	'</a>'

								,	'<button onclick="loadFromURL(this, \''
								+		pathAttr
								+	'\')">'
								+		la.buttons.load
								+	'</button>'
								].join('</td><td>')
							+	'</td></tr>'
							);
						}
					).join('')
				+		'</table>'
				+	'</div>'
				);
			}
		);
	}

	s = cre('section', container);
	e = cre('div', s);
	e.id = 'project-container';

	e = window;
	a = {
//* 'drop' event may not work without 'dragover'
		'dragover':	onPageDragOver
	,	'drop':		onPageDrop
	};
	for (i in a) e.addEventListener(i, a[i], false);

	logTime('ready to work');
}

document.addEventListener('DOMContentLoaded', init, false);
