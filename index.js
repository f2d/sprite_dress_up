
//* source file data:
//* TODO: read PSD layer masks.
//* TODO: save as ORA.

//* menu:
//* TODO: buttons: show/save [all marked and visible options], [all marked], [all].
//* TODO: options menu: add/remove/copy colors.
//* TODO: N px outline, select color.
//*	a) max alpha in +|- N px around,
//*	b) min distance to any non-transparent px (map the 0,N:N+1,+Inf range to 255:0).

//* rendering:
//* TODO: arithmetic emulation of all blending operations, not native to JS.
//* TODO: arithmetic emulation of all operations in 16-bit or more, until final result; to be optionally available as checkbox/selectbox.
//*	Uint8ClampedArray: [0,255], used internally by canvas.
//*	Int16Array: [-32768,32767], allows subprecision, user must somehow manually clamp result overflows.
//*	Int32Array: [-2147483648,2147483647], same + more space for overflow/clamping (useless?).
//*	Float32Array: [0,1], allows overflow/clamping too.
//*	Float64Array: [0,1], same + more precision.
//* TODO: decode layer data (PSD/PNG/etc) manually without using canvas, to avoid premultiplied-alpha (in Firefox, not needed in Chrome) while rendering (including result).
//* TODO: img src: recompress using temporary canvas, save whichever is shorter (original vs temp) as base64 or blob.

//* Config *-------------------------------------------------------------------

var	regLayerNameToSkip		= /^(skip)$/i
,	regLayerNameParamOrComment	= /(?:^|[\s_]*)(?:\[([^\[\]]*)\]|\([^()]*\))(?:[\s_]*|$)/i
,	regLayerNameParamSplit		= /[\s,_]+/g
,	regLayerNameParamTrim		= /^[\s,_]+|[\s,_]+$/g
//* examples of comments: "... (1) ... (copy 2) (etc)"
//* examples of params: "... [param] ... [param,param param]"

,	regLayerNameParamType = {
//* TODO: keep all parameters single-word if possible.
		'skip':		/^(skip)$/i
	,	'colors':	/^(colou?r)s$/i
	,	'parts':	/^(option|part|type)s$/i
	,	'if_only':	/^(if|in)$/i
	,	'not':		/^(\!|not?)$/i
	,	'any':		/^(\?|any|some)$/i
	,	'outline':	/^(outline)$/i
	,	'radius':	/^(\d+)px$/i

/* examples of layer folder names with parameter syntax:
	"[if no any parts] arm"	(render contents of this folder if "part: arm" select box value is empty)
	"[if any colors] 1"	(render contents of this folder if "color: 1" select box value is non-empty)
	"[if not colors] 1"	(render only those subfolders, which are named not as the "color: 1" select box value)
	"[if colors] 1"		(render only those subfolders, which are named same as the "color: 1" select box value)

	Note: [parts] folder without [if] uses logical parameters just the same way.
	Note: [colors] folder without [if] gets replaced with selected color, or skipped if empty value is selected.
*/
	,	'multi_select':	/^x(\d*)([+-](\d*))?$/i
/* examples of 'multi_select' parameter value:
	[x0-1]	(1 or none)
	[x1+]	(1 or more)
	[x2]	(exactly 2)
	[x]	(any, from none to all at once)

	Note: [parts] cannot be selected more than 1 at once currently.
	Note: [colors] cannot be selected more than 1 at once (they will overwrite anyway).
*/

//* preselect last (may be empty or not, depending on 'multi_select' param):
	,	'last':		/^(last)$/i

//* for batch export - iterate this list or only use selected variant (first found makes another to be default):
	,	'batch':	/^(batch)$/i
	,	'preselect':	/^(batch-fix|batch-single|no-batch|pre-?select)(-last)?$/i

//* for export filename - omit this list title:
	,	'no_prefix':	/^(no-prefix)$/i
	}
,	regLayerTypeSingleTrim	= /s+$/i
,	regSpace		= /\s+/g
,	regTrim			= /^\s+|\s+$/g
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
,	NAME_PARTS_ORDER = ['parts', 'colors']
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
	// ,	['liner', 'linear']
	,	[/^.*:/g]
	,	[/[\s\/_-]+/g, '-']
	]
//* JS-native:
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
,	BLEND_MODES_REMAP = {
		'normal':	BLEND_MODE_NORMAL
	,	'clipping':	BLEND_MODE_CLIP
	,	'add':		BLEND_MODE_ADD
	,	'linear-dodge':	BLEND_MODE_ADD
//* from SAI2:
	,	'burn':		'color-burn'
	,	'burn-dodge':	'vivid-light'
	,	'darken-color':	'darker-color'
	,	'dodge':	'color-dodge'
	,	'exclude':	'exclusion'
	,	'lighten-color':'lighter-color'
	,	'liner-burn':	'linear-burn'
	,	'liner-dodge':	BLEND_MODE_ADD
	,	'liner-light':	'linear-light'
	,	'shade':	'linear-burn'
	,	'shade-shine':	'linear-light'
	,	'shine':	BLEND_MODE_ADD
	,	'substruct':	'substract'
	}
,	BLEND_MODES_EMULATED = [
//* JS-native blending will be used automatically when available:
		'darker-color'
	,	'divide'
	,	'hard-mix'
	,	'lighter-color'
	,	'linear-burn'
	,	'linear-light'
	,	'pin-light'
	,	'substract'
	,	'vivid-light'
	]
,	PSD_COLOR_MODES = [
//* taken from PSDLIB.js:
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
,	project = {}
	;

//* Config: loaders of project files *-----------------------------------------

var	examplesDir = 'example_project_files/'
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

//* situation: draw in SAI2 → export PSD → import PSD in Krita (loses clipping groups) → export ORA (loses opacity masks)
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

function toArray(a) {try {return TOS.slice.call(a);} catch (e) {return [];}}
function arrayFilterNonEmptyValues(v) {return !!v;}
function arrayFilterUniqueValues(v,i,a) {return a.indexOf(v) === i;}

//* https://stackoverflow.com/a/33703102
//* a, b = TypedArray of same type
function concatTypedArrays(a,b,c,n) {
var	c = new (c || a.constructor)(n || (a.length + b.length));
	c.set(a, 0);
	c.set(b, a.length);
	return c;
}

function concatTypedArraysPaddedForHeap(a,b) {
var	realSize = a.length + b.length
,	paddedSize = nextValidHeapSize(realSize)
	;

	// console.log([realSize, paddedSize]);

var	d = new ArrayBuffer(paddedSize)
,	c = new Uint8Array(d)
	;
	c.set(a, 0);
	c.set(b, a.length);
	return c;
}

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

function orz(n,d) {return (isNaN(d) ? parseInt(n||0) : parseFloat(n||d))||0;}
function orzFloat(n) {return orz(n, 4);}
function leftPad(n, len, pad) {
	n = '' + orz(n);
	len = orz(len) || 2;
	pad = '' + (pad || 0);
	while (n.length < len) n = pad+n;
	return n;
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

function showProps(target, flags, spaces, keyTest, valueTest) {
/* flags:
	1 = return, don't alert
	2 = skip if value evaluates to false
	4 = only keys
	8 = only values
	0x10 = 16 = nested once
	0x20 = 32 = nested recursive
*/
var	k,v,j = ' '
,	output = ''
,	sep = ': '
	;
	try {
		if (flags & 16) {
			v = (flags & 32 ? flags : flags - 16) | 1;
			output = Object.keys(target).map(
				function(k) {
					return k+sep+showProps(target[k], v, spaces, keyTest, valueTest);
				}
			).join('\n\n');
		} else {
			if (!Object.keys(target)) throw new TypeError('test');
			for (k in target) if (
				((v = target[k]) || !(flags & 2))
			&&	(!keyTest   || !keyTest  .test || keyTest  .test(k))
			&&	(!valueTest || !valueTest.test || valueTest.test(v))
			) output += (
				(output?'\n':'')
			+	((flags & 8)?'':k)
			+	((flags &12)?'':' = ')
			+	((flags & 4)?'':(spaces && v?(v+j).split(j, spaces).join(j):v))
			);
		}
	} catch (error) {
		output = (typeof target)+sep+target;
	}
	return (flags & 1) ? output : alert(output);
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
		,	scripts = lib.files || []
			;
			addNextScript();
		}
	);
}

async function loadLibOnDemand(libName) {

	async function loadLibDepends(depends) {
	}

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

//* TODO: get array of pixels without premultiplied alpha

			function checkResult(canvas, img) {
			var	oldSrc = img.src
			,	newSrc = canvas.toDataURL()
			,	isOldBetter = (newSrc.length >= oldSrc.length)
			,	blob = dataToBlob(isOldBetter ? oldSrc : newSrc)
				;
				// console.log(['isOldBetter', isOldBetter, oldSrc.length, newSrc.length, img]);

				// if (!isOldBetter) {
				// var	blob = dataToBlob(isOldBetter ? oldSrc : newSrc);
					if (blob) newSrc = blob.url; else
					if (isOldBetter) newSrc = null;

					if (newSrc) {
						img.onload = () => resolve(img);
						img.src = newSrc;
					} else {
						resolve(img);
					}
				// }
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
			/*	if (ctx = canvas.getContext('webgl', {
					'premultipliedAlpha': false
				})) {
					// ctx.pixelStorei(ctx.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
					ctx.clearColor(0.0, 0.0, 0.0, 1.0);
					ctx.clear(ctx.COLOR_BUFFER_BIT);
				} else
				if (ctx = canvas.getContext('bitmaprenderer')) {
					createImageBitmap(img, 0,0, w,h, {
						'premultiplyAlpha': 'none'	//* <- does not help; decode PNG manually to get real values?
					,	'resizeQuality': 'pixelated'
					}).then(
						(b) => {
							// console.log(['bmp', b]);

							ctx.transferFromImageBitmap(b);
							checkResult(canvas, img);
						}
					);
				} else
			*/	if (ctx = canvas.getContext('2d')) {
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
			var	n = layer.name
			,	params = layer.params
			,	i,j,k,p
				;

				if (
					params.skip
				||	regLayerNameToSkip.test(n)
				) {
					return;
				}

//* add option group:

				if (layer.isOptionList) {
				var	t = layer.type
				,	o = (options || (options = {}))
				,	o = (o[t] || (o[t] = {}))
				,	g = (o[n] || (o[n] = {
						'params': {}
					,	'items': {}
					})).params
					;
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
						'batch',
						'preselect',
					]) if (params[k]) {
						if (!projectWIP.batch.paramNameDefault) {
							projectWIP.batch.paramNameMarked = k;
							projectWIP.batch.paramNameDefault = getOtherBatchParam(k);
						}
						g[k] = true;
					}

					for (k of [
						'last',
						'no_prefix',
					]) {
						if (params[k]) g[k] = true;
					}
				} else

//* add item to option group:

				if (
					(p = getParentLayer(layer))
				&&	p.isOptionList
				) {
				var	parentOptions = getLayerParentOptions(layer)
				,	k = p.name
				,	t = p.type
				,	o = options[t]
				,	g = o[k].items
				,	a = (g[n] || (g[n] = {
						'layer': layer
					,	'requires': {}
					,	'except': {}
					}))
					;
					layer.isOption = true;
					layer.type = t.replace(regLayerTypeSingleTrim, '');

//* TODO: debug all cases of inclusion/exclusion logic, [not], etc:

					j = (
						!params.not === !p.params.not
						? 'requires'
						: 'except'
					);
					a[j] = mergeDictOfArrays(a[j], parentOptions);
				}

				if (a = layer.layers) {
					a.map(processLayerInBranch);
				} else
				if (layer.opacity > 0) {
					projectWIP.loading.images.push(layer);
				}
			}

		var	options, k;
			projectWIP.layers.map(processLayerInBranch);

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

					// console.log([layer.name, img]);

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

				// loadProjectFinalizeDisplayFallBack(projectWIP);
			}
		} catch (error) {
			console.log(error);

			if (projectWIP.options) {
				projectWIP.options = null;
				delete projectWIP.options;
			}

			// loadProjectFinalizeDisplayFallBack(projectWIP);
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
		if (i && i == j) {
			t.push(i + ' ' + la.project.layers + ' (' + la.project.images + ')');
		} else {
			if (i) t.push(i + ' ' + la.project.images);
			if (j) t.push(j + ' ' + la.project.layers);
		}

		if (sourceFile.size) t.push(sourceFile.size + ' ' + la.project.bytes);
		if (sourceFileTime) t.push(la.project.date + ' ' + getFormattedTime(sourceFileTime));

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
	// ,	table = cre('table', cre('div', e))
	,	table, tr, td
		;
		if (table)
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

	/*	e = cre('p', container);
		e.style.backgroundColor = 'red';

		addButton('save data JSON', 'saveDL(project.sourceData, "data", "json", 1, replaceJSONpartsFromPSD)', e);
		addButton('save tree JSON', 'saveDL(project.layers, "tree", "json", 1, replaceJSONpartsFromTree)', e);
		addButton('save project JSON', 'saveDL(project, "project", "json", 1, replaceJSONpartsFromPSD)', e);*/

//* place for results:

		tr = cre('tr', cre('table', container));
		cre('td', tr).id = 'project-options';
		cre('td', tr).id = 'render';
	}

	function createOptionsMenu(options, container) {

		function updateBatchCheckbox(params) {
			return function(e) {
				params.preselect = e.target.checked;

				// console.log(JSON.stringify(params));
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
				i.addEventListener('change', updateBatchCheckbox(params), false);

			var	s = cre('select', optionBox);
				s.name = listName;
				s.title = JSON.stringify(params);
				s.setAttribute('data-section', sectionName);
				s.addEventListener('change', updateMenuAndRender, false);

//* list item = each part:

				for (var optionName in items) /*if (f = items[name])*/ {
					addOption(s, optionName || '?');
				}

				if (
					params.multi_select
				&&	params.multi_select.min <= 0
				) {
					addOption(s, '');
					// n.innerHTML = '&mdash;';
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
				if (NAME_PARTS_ORDER.indexOf(k) >= 0) {
					if (!layer.type && isLayerFolder) {
						layer.type = k;
					}
				} else if (k === 'multi_select') {
					v = orz(m[1]);
					params[k] = {
						'min': Math.max(0, v)
					,	'max': Math.max(1, m[2] ? orz(m[3]) : v)
					};
				} else {
					if (k == 'preselect' && param.indexOf('last') >= 0) params.last = true;
					params[k] = k;
				}
			}
		}
		if (layer.type) {
			if (params.any) {
				layer.isOptionIf = true;
			} else {
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
		// console.log(['sourceData', sourceData]);

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

		var	l_i = projectWIP.layersCount = sourceData.layersCount;

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

		var	l_i = projectWIP.layersCount = sourceData.layers.length
		,	m
			;

			if (!l_i) return;

			projectWIP.width	= sourceData.header.cols;
			projectWIP.height	= sourceData.header.rows;
			projectWIP.colorMode	= (isNaN(m = sourceData.header.mode) ? m : PSD_COLOR_MODES[m]);
			projectWIP.channels	= sourceData.header.channels;
			projectWIP.bitDepth	= sourceData.header.depth;

//* gather layers into a tree object:

			function addLayerToTree(layer, parentGroup) {
			var	l = layer.layer || layer

//* "fill" opacity is used by SAI2 instead of usual one for layers with certain blending modes when exporting to PSD.
//* source: https://github.com/meltingice/psd.js/issues/153#issuecomment-436456896

			,	fo = (
					l.fillOpacity
					? getProperOpacity(l.fillOpacity().layer.adjustments.fillOpacity.obj.value)
					: 1
				)

//* layer masks are complicated in PSD

			/*,	i = l.image || layer.image || layer
			,	n = l.node  || layer.node || layer
			,	n = n.layer || n
			,	m = n.mask  || n
			,	mask = (
					m
					? {
						top:    m.top
					,	left:   m.left
					,	width:  m.width
					,	height: m.height
					,	color:  m.defaultColor
					,	data:   i.maskData
					}
					: null
				)*/

			,	m = l.blendMode || layer.blendMode || {}
			,	n = layer.name || ''
			,	layers = layer.hasChildren() ? layer.children() : null
			,	isLayerFolder = (layers && layers.length > 0)
			,	parentGroup = getNextParentAfterAddingLayerToTree(
					{
						top:    orz(l.top)
					,	left:   orz(l.left)
					,	width:  orz(l.width)
					,	height: orz(l.height)
					,	clipping:  getTruthyValue(layer.clipped || m.clipped || m.clipping)
					,	opacity:   getProperOpacity(l.opacity) * fo
					,	blendMode: getProperBlendMode(m.mode || m)
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

			// console.log(sectionName +' '+ listName +' '+ JSON.stringify(params) +' '+ (b?'single':'batch') +' '+ JSON.stringify(o));
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
			var	optionName = optionNames[i]
//* source:
//* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#Deep_Clone

			,	values = JSON.parse(JSON.stringify(partialValueSet || {}))
			,	section = (values[sectionName] || (values[sectionName] = {}))
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

	function applyBlendingEmulation(a,b, blendMode) {

//* try computing in asm.js:

	var	funcName = blendMode.replace(/\W+/g, '_').toLowerCase();

		if (
			CompositionModule
		&&	CompositionFuncList
		&&	CompositionFuncList.indexOf(funcName) >= 0
		) {
			try {
			var	i = a.length
			,	uint8array = concatTypedArraysPaddedForHeap(b,a)
			,	env = null
			,	heap = uint8array.buffer
			,	compute = CompositionModule(window, env, heap)
				;
				compute[funcName](i);
				a.set(uint8array.slice(0, i));

				return;

			} catch (error) {
				console.log(error);
			}
		}

//* try computing in pure JS:

//* default "Normal" as fallback:
	var	RGBexpression = (
			'if (alphaAbove !== 1) a[i] = alphaAbove*a[i] + alphaAComp*b[i];'
		);

//* blend A onto B, pixel by pixel (C):
//* source: http://www.simplefilter.de/en/basics/mixmods.html


/* TODO:
'darker-color'	[need formula]
'lighter-color'	[need formula]
'divide'
'hard-mix'	[partly done]
'linear-burn'	[partly done]
'linear-light'	[partly done]
'pin-light'
'substract'
'vivid-light'
*/

/*
source: https://limnu.com/webgl-blending-youre-probably-wrong/

Premultiplied colors are what your compositor or renderer spits out, even if you used straight-alpha images with straight-alpha blending. In order to get a straight-alpha image out, you have to add an extra step to UN-pre-multiply, or divide by alpha. And pre-multiplying is bad enough, nobody wants to post-divide.

With straight alpha, your blending function is symmetric. A*x + B*(1-x). We're used to that math, and it just feels right, it makes sense. Premultiplied blending, A + B*(1-x), looks strange, doesn't it?
*/
		if (blendMode === 'hard-mix') {

//* A < 1-B: C = 0;
//* A > 1-B: C = 1;
//* TODO: alpha multipliers

			RGBexpression = (
				'a[i] = (a[i] + b[i] < k ? 0 : MAX);'
			);
		} else
		if (blendMode === 'linear-burn') {

//* C = B + A - 1;
//* TODO: fix alpha multipliers, still wrong if bottom layer alpha < 100%

			RGBexpression = (
				'if (alphaBelow !== 0) {'
			+	'	j = alphaAbove*a[i] + alphaAComp*b[i];'
			+	'	k = b[i] + alphaAbove*(a[i] - MAX);'
			+	'	a[i] = alphaBComp*j + alphaBelow*k;'
			+	'}'
			);

		} else
		if (blendMode === 'linear-light') {

//* C = B + 2*A - 1;
//* TODO: fix alpha multipliers, still wrong if bottom layer alpha < 100%

			RGBexpression = (
				'if (alphaBelow !== 0) {'
			+	'	j = alphaAbove*a[i] + alphaAComp*b[i];'
			+	'	k = b[i] + alphaAbove*(a[i]*2 - MAX);'
			+	'	a[i] = alphaBComp*j + alphaBelow*k;'
			+	'}'
			);
		}

/* target sample values in RGBA, top layer is using "linear-light" ("Shade/shine" in SAI2):

above  =   0, 170,   0, 127
below  = 131, 208, 255, 127
result =   2, 224,  85, 191

above  =   0, 170,   0, 127
below  = 255, 128,   0, 127
result =  85, 170,   0, 191

above  =   0, 170,   0, 127
below  = 172,  69,  85, 191
result =  38, 120,   0, 223

above  =   0, 170,   0, 127
below  = 255,  85,   0, 191
result = 109, 134,   0, 223

above  =   0, 170,   0, 127
below  = 220, 118,  73, 223
result =  86, 161,   0, 239
*/

	var	aa  = !(RGBexpression.indexOf('alphaAbove') < 0)
	,	ab  = !(RGBexpression.indexOf('alphaBelow') < 0)
	,	am  = !(RGBexpression.indexOf('alphaMixed') < 0)
	,	aac = !(RGBexpression.indexOf('alphaAComp') < 0)
	,	abc = !(RGBexpression.indexOf('alphaBComp') < 0)
	,	amc = !(RGBexpression.indexOf('alphaMComp') < 0)
	,	aan = !(RGBexpression.indexOf('alphaANorm') < 0)
	,	abn = !(RGBexpression.indexOf('alphaBNorm') < 0)
	,	an = aan || abn
	,	i = a.length
	,	j,k
	,	MAX = 255
	,	codeBlock = (
			[
				'while (i--) if (i%4 === 3) {'
//* blend alpha channel:
			,	'	j = a[i];'
			,	'	k = b[i];'
			,	'var	alphaAbove = j / MAX'
			,(ab?	',	alphaBelow = k / MAX':'')
			,(aac?	',	alphaAComp = 1 - alphaAbove':'')
			,(abc?	',	alphaBComp = 1 - alphaBelow':'')
			,(an?	',	alphaSum   = alphaAbove + alphaBelow':'')
			,(aan?	',	alphaANorm = alphaAbove / alphaSum':'')
			,(abn?	',	alphaBNorm = alphaBelow / alphaSum':'')
			,	'	;'
			,	'	if (j === 0) {'
			,	'		a[i] = k;'
			,	'	} else'
			,	'	if (j !== MAX) {'
			,	'		if (k === MAX) {'
			,	'			a[i] = k;'
			,	'		} else {'
			,	'			a[i] = k + alphaAbove * (MAX - k);'
			,	'		}'
			,	'	}'
			,(am?	'	alphaMixed = a[i] / MAX;':'')
			,(amc?	'	alphaMComp = 1 - alphaMixed;':'')
			,	'} else {'
//* blend color channels:
			,	'	if (alphaAbove === 0) {'
			,	'		a[i] = b[i];'
			,	'	} else ' + RGBexpression
			,	'}'
			]
			.join('\n')
			.replace(/\bMAX\b/g, MAX)
		);

		// console.log(codeBlock);

		eval(codeBlock);
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

//* use native JS blending if available, or emulation is not available yet:

	if (
		m === blendMode
	||	BLEND_MODES_EMULATED.indexOf(blendMode) < 0
	) {
		ctx.globalAlpha = opacity;

		drawImageOrColorInside();
	} else {

//* otherwise, try blending emulation:

		// console.log('globalCompositeOperation = '+m+', blendMode = '+blendMode+', opacity = '+opacity);

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

		applyBlendingEmulation(a,b, blendMode);

		ctx.putImageData(newData, 0,0);
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

	while (i--) if (i%4 === 3) d[i] = 255;

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
		var	o = optionalColors[optionName].items[selectedColors[optionName]];
			if (o) {
				o = o.color || (
					o.layer
					? o.layer.img
					: o.img
				);
				img = getImageDataBlended(
					(img || o)
				,	(img ? o : null)
				);
			} else {
				// console.log([optionName, optionalColors, selectedColors, o]);
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
				if (!params.not === !values[t][n]) continue;
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

			if (layer.opacity <= 0) continue;

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

function getFileNameByValues(values, checkPreselected) {
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
							if (
								checkPreselected
							&&	!params.batch
							) {
								continue;
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

function getFileNameByValuesToSave(values, checkPreselected) {
	return (
		[
			project.baseName
		,	getFileNameByValues(values || getMenuValues(), checkPreselected)
		]
		.filter(arrayFilterNonEmptyValues)
		.join('_')
	);
}

function getOrCreateRender(render) {
	if (!render) render = {};
var	values   = render.values   || (render.values   = getMenuValues())
,	fileName = render.fileName || (render.fileName = getFileNameByValuesToSave(values))
,	img      = render.img      || (render.img      = getOrCreateRenderedImg(render))
// ,	imgData  = render.imgData  || (render.imgData  = img.src)
	;
	return render;
}

function getOrCreateRenderedImg(render) {
	if (!render) render = getOrCreateRender();

	if (e = render.img) return e;

var	fileName = render.fileName
,	prerenders = (project.renders || (project.renders = {}))
	;

	if (e = prerenders[fileName]) return e;

var	canvas = getRenderByValues(render.values);
	if (canvas) {
	var	data = canvas.toDataURL()
	,	blob = dataToBlob(data)
	,	e = cre('img')
		;
		e.title = //la.hint.canvas;
		e.alt = fileName;
		e.width = project.width;
		e.height = project.height;
		e.src = (blob ? blob.url : data);

		prerenders[fileName] = e;
	}

	return e;
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

var	sets = getAllValueSets(true)
,	setsCountAtOnce = 0
,	setsCount = 0
,	container = (showOnPage ? delAllChildNodes(id('render-all') || id('render')) : null)
,	startTime = +new Date
,	lastPauseTime = startTime
	;
	for (var fileName in sets) if (values = sets[fileName]) {
	var	render = getOrCreateRender(
			{
				'values': values
			,	'fileName': fileName
			}
		);
		if (saveToFile) saveImg(render, getFileNameByValuesToSave(values, true));
		if (showOnPage) showImg(render, container);

		setsCount++;
		setsCountAtOnce++;

//* https://stackoverflow.com/a/53841885/8352410
//* must wait at least 1 second between each 10 downloads in Chrome:

		if (
			(setsCountAtOnce > 9)
		||	(+new Date - lastPauseTime > 500)
		) {
			await pause(saveToFile ? (100 * setsCountAtOnce) : 100);
			lastPauseTime = +new Date;
			setsCountAtOnce = 0;
		}
	}

	logTime('finished rendering ' + setsCount + ' sets, total ' + (+new Date - startTime) + ' ms');
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

function showImg(render, container) {

//* prepare before container cleanup to avoid flicker:
var	img = getOrCreateRenderedImg(render);

	(
		container
	||	delAllChildNodes(id('render'))
	).appendChild(
		img
	);
}

function saveImg(render, fileName) {
	render = getOrCreateRender(render);

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
,	totalFiles = 0
,	files, name, ext, projectRenderFallBack
	;

	for (var batch of [e.dataTransfer, e.target]) if (
		batch
	&&	(files = batch.files)
	&&	files.length
	) {
		// if (batch.types) console.log(batch.types);

		for (var file of files) if (
			file
		&&	(name = file.name).length > 0
		&&	(ext = getFileExt(name)).length > 0
		) {
			totalFiles += 1;

		var	projectWIP = await loadProject(
				{
					evt: e
				,	file: file
				,	name: name
				,	ext: ext
				}
			);

			if (projectWIP) {
				if (projectWIP.options) return true;

				if (!projectRenderFallBack) projectRenderFallBack = projectWIP;
			}
		}
	}

	if (projectRenderFallBack) {
		loadProjectFinalizeDisplayFallBack(projectRenderFallBack);
	} else {
		alert(la.error.file + ' / ' + totalFiles);
	}
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
,	projectWIP = await loadProject(
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

	if (projectWIP) {
		if (projectWIP.options) return true;

		loadProjectFinalizeDisplayFallBack(projectWIP);
	} else {
		alert(la.error.file + ' : ' + url);
	}
}

//* Runtime: prepare UI *------------------------------------------------------

async function init() {
	await loadLib({'files': [libDir + 'blending/composition.asm.js']});

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

	e = cre('div', s);
	e.id = 'examples';

	cre('p', e).textContent = la.example.common;

	[
		{
			'example': 'ora_mockup'
		,	'files': [
				['icon.ora'	, '128x128, 70 K'],
			//	['unit_base.ora', '768x768, 1.6 M'],
			]
		},
		{
			'example': 'psd_from_sai2'
		,	'files': [
				['icon.psd'	, '128x128, 153 K'],
			//	['portrait.psd'	, '256x256, 1.3 M'],
			//	['unit.psd'	, '256x256, 2.1 M'],
			//	['unit_base.psd', '768x768, 5.2 M'],
			]
		},
	].map(
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
					,	filePath = examplesDir + fileName
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
