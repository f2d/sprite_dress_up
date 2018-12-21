//* modified version of https://github.com/zsgalusz/ora.js

(function (obj) {
	'use strict';

var	layerDefaults = {
		name: 'New Layer'
	,	x: 0
	,	y: 0
	,	width: 0
	,	height: 0
	,	opacity: 1
	,	clipping: 'none'
	,	composite: 'svg:src-over'
	,	visibility: 'visible'
	};

var	stackDefaults = {
		name: 'New Folder'
	,	x: 0
	,	y: 0
	,	opacity: 1
	,	clipping: 'none'
	,	composite: 'svg:src-over'
	,	visibility: 'visible'
	,	isolation: 'isolate'
	};

var	layerAttributeName = {
		name: 'name'
	,	x: 'x'
	,	y: 'y'
	,	opacity: 'opacity'
	,	clipping: 'clipping'
	,	composite: 'composite-op'
	,	visibility: 'visibility'
	,	src: 'src'
	};

var	stackAttributeName = {
		name: 'name'
	,	x: 'x'
	,	y: 'y'
	,	opacity: 'opacity'
	,	clipping: 'clipping'
	,	composite: 'composite-op'
	,	visibility: 'visibility'
	,	isolation: 'isolation'
	};

var	URL_API = window.URL || window.webkitURL;

//* Extract an image from the ora into an Image object
//* dataURI has length limits
//* TODO: automatically use blob for large files?
	function extractImage(path, zipfs, onDone, onError, getImageWithBlob) {
	var	file = zipfs.find(path);
		if (file) {
		var	onDataLoad = function (data, blob) {
			var	img = new Image();
				img.onload = onDone;
				img.src = data;
				// if (blob) img.blob = blob;
			};
			if (getImageWithBlob) {
				file.getBlob('image/png', function (blob) {
					onDataLoad(URL_API.createObjectURL(blob), blob);
				});
			} else {
				file.getData64URI('image/png', onDataLoad);
			}
		} else if (onError) {
			onError();
		}
	}

//* Resize a canvas to the given size
	function resize(canvas, width, height, callback) {
		if (canvas.width <= width && canvas.height <= height) {
			callback();
			return;
		}

	var	ctx = canvas.getContext('2d');
	var	oldCanvas = canvas.toDataURL('image/png');
	var	img = new Image();
	var	aspect = canvas.width / canvas.height;

		if (aspect >= 1) {
			height = width / aspect;
		} else {
			width = height * aspect;
		}

		img.src = oldCanvas;
		img.onload = function () {
			canvas.width = width;
			canvas.height = height;
			ctx.clearRect(0, 0, width, height);
			ctx.drawImage(img, 0, 0, width, height);
			callback();
		};
	}

//* Stack object constructor.
	function Stack(name) {
		for (var i in stackDefaults) {
			this[i] = stackDefaults[i];
		}
		if (name) this.name = name;
	}

//* Layer object constructor.
	function Layer(name, width, height) {
		for (var i in layerDefaults) {
			this[i] = layerDefaults[i];
		}
		if (name)   this.name   = name;
		if (width)  this.width  = width;
		if (height) this.height = height;
	}

//* Draw layer onto a new canvas element
	Layer.prototype.toCanvas = function (canvas, width, height, noOffset) {
	var	tmpCanvas = canvas || document.createElement('canvas');
		tmpCanvas.width  = width  || this.width;
		tmpCanvas.height = height || this.height;

	var	tmpCtx = tmpCanvas.getContext('2d');
		tmpCtx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);
		if (noOffset) {
			tmpCtx.drawImage(this.image, 0, 0);
		} else {
			tmpCtx.drawImage(this.image, this.x, this.y);
		}
		return tmpCanvas;
	};

//* OraFile constructor
	function OraFile(width, height) {
		this.width = width || 0;
		this.height = height || 0;
		this.layers = [];
	}

//* Load the file contents from a blob
//* Based on the draft specification from May 2013
//* http://www.freedesktop.org/wiki/Specifications/OpenRaster/Draft/
//* Plus some custom extensions from 2018-10-25
	OraFile.prototype.load = function (blob, onload, param) {
		setZipParams();

	var	fs = new zip.fs.FS();
	var	that = this;

		if (!param || typeof param !== 'object') param = {};

	var	getImageWithBlob = !!param.getImageWithBlob;

		function loadLayers(image, onDone) {

		var	onLayerDone = function() {
				if (++layersLoaded >= layersCount) {
					onDone();
				}
			};

		var	onExtract = function(layer) {
				return function(e) {
					if (e) {
					var	i = e.target;
						if (i) {
							layer.image  = i;
							layer.width  = i.width;
							layer.height = i.height;
						} else {
							layer.image = e;
						}
					}

					onLayerDone();
				};
			};

		var	loadChildLayer = function(layerElement, parentElement) {
			var	layer = new Layer();
				for (var i in layerAttributeName) {
				var	k = layerAttributeName[i];
				var	v = layerElement.getAttribute(k);
					if (v !== null) layer[i] = v;
				}
				extractImage(layer.src, fs, onExtract(layer), onLayerDone, getImageWithBlob);

				return layer;
			};

		var	loadChildStack = function(stackElement, parentElement) {
			var	stack = new Stack();
				for (var i in stackAttributeName) {
				var	k = stackAttributeName[i];
				var	v = stackElement.getAttribute(k);
					if (v !== null) stack[i] = v;
				}
				stack.layers = loadChildren(stackElement, stack);

				return stack;
			};

		var	loadChildren = function(parentElement, parent) {
			var	layers = [];
			var	e = parentElement.firstChild;
				while (e) {
				var	child = null;
				var	n = e.tagName;
					if (n) {
						n = n.toLowerCase();
						if (n === 'layer') child = loadChildLayer(e, parentElement); else
						if (n === 'stack') child = loadChildStack(e, parentElement);
					}
					if (child) {
						child.parent = parent;
						layers.push(child);
					}
					e = e.nextSibling;
				}
				return layers;
			};

		var	layersLoaded = 0;
		var	layersCount = that.layersCount = image.getElementsByTagName('layer').length;
		var	stacksCount = that.stacksCount = image.getElementsByTagName('stack').length;

			that.layers = loadChildren(image, that);
		}

		function loadStack(onDone) {
		var	stackFile = fs.find('stack.xml');
		var	onExtract = function(text) {
			var	xml;
//* http://stackoverflow.com/questions/649614/xml-parsing-of-a-variable-string-in-javascript

				if (window.DOMParser) {
					xml = ( new window.DOMParser() ).parseFromString(text, 'text/xml');
				} else {
					xml = new window.ActiveXObject('Microsoft.XMLDOM');
					xml.async = false;
					xml.loadXML(text);
				}

			var	img = xml.getElementsByTagName('image')[0];
				that.width = img.getAttribute('w');
				that.height = img.getAttribute('h');

				loadLayers(img, onDone);
			};

//* for some reason Firefox (23.0.1 and earlier) doesn't like getText, so we roll our own
			stackFile.getBlob('text/xml', function (blob) {
			var	reader = new FileReader();
				reader.onload = function(e) {
					onExtract(e.target.result);
				};
				reader.readAsText(blob, 'UTF-8');
			});
		}

		function loadOra() {
//* keeping track of finished loading tasks
		var	stepsDone = 0;
		var	steps = 3;
		var	onDone = function () {
				if (++stepsDone >= steps) {
					onload();
				}
			};

			extractImage('Thumbnails/thumbnail.png', fs, function() {
				that.thumbnail = this;
				onDone();
			}, onDone);

			extractImage('mergedimage.png', fs, function() {
				that.prerendered = this;
				onDone();
			}, onDone);

			loadStack(onDone);
		}

		fs.importBlob(blob, loadOra);
	};

	OraFile.prototype.save = function(onDone) {
		setZipParams();

	var	fs         = new zip.fs.FS();
	var	thumbs     = fs.root.addDirectory('Thumbnails');
	var	data       = fs.root.addDirectory('data');
	var	tmpCanvas  = document.createElement('canvas');
	var	xmlDoc     = document.implementation.createDocument(null, null, null);
	var	serializer = new XMLSerializer();

		fs.root.addText('mimetype', 'image/openraster');

	var	imageElem = xmlDoc.createElement('image');
		imageElem.setAttribute('w', this.width);
		imageElem.setAttribute('h', this.height);
		xmlDoc.appendChild(imageElem);

	var	stackElem = xmlDoc.createElement('stack');
		imageElem.appendChild(stackElem);

	var	i = this.layers.length;

		while (i-- > 0) {
		var	layer = this.layers[i];

		var	name = 'layer' + i + '.png';
		var	url = layer.toCanvas(undefined, layer.width, layer.height, true).toDataURL('image/png');
			data.addData64URI(name, url);

		var	layerElem = xmlDoc.createElement('layer');
			layerElem.setAttribute('src'         , 'data/' + name);
			layerElem.setAttribute('name'        , layer.name || ('layer' + i));
			layerElem.setAttribute('x'           , layer.x);
			layerElem.setAttribute('y'           , layer.y);
			layerElem.setAttribute('opacity'     , layer.opacity);
			layerElem.setAttribute('clipping'    , layer.clipping);
			layerElem.setAttribute('composite-op', layer.composite);
			layerElem.setAttribute('visibility'  , layer.visibility);

			stackElem.appendChild(layerElem);
		}

		fs.root.addText('stack.xml', serializer.serializeToString(xmlDoc));

		this.drawComposite(tmpCanvas, function() {
		var	url = tmpCanvas.toDataURL('image/png');
			fs.root.addData64URI('mergedimage.png', url);

			resize(tmpCanvas, 256, 256, function() {
			var	url = tmpCanvas.toDataURL('image/png');
				thumbs.addData64URI('thumbnail.png', url);

				fs.exportBlob(onDone, 'image/openraster');
			});
		});
	};

//* Draw the thumbnail into a canvas element
	OraFile.prototype.drawThumbnail = function (canvas) {
	var	context = canvas.getContext('2d');

		if (this.thumbnail) {
			canvas.width = this.thumbnail.width;
			canvas.height = this.thumbnail.height;
			context.clearRect(0, 0, canvas.width, canvas.height);
			context.drawImage(this.thumbnail, 0, 0);
		} else {
			context.clearRect(0, 0, canvas.width, canvas.height);
		}
	};

//* Draw the full size composite image from the layer data.
//* Uses the prerendered image if present and enabled
	OraFile.prototype.drawComposite = function (canvas, onDone) {
		canvas.width = this.width;
		canvas.height = this.height;

		if (!this.layers) {
			if (onDone) {
				onDone();
			}

			return;
		}

	var	context = canvas.getContext('2d');

		context.clearRect(0, 0, canvas.width, canvas.height);

		if (obj.ora.enablePrerendered && this.prerendered) {
			context.drawImage(this.prerendered, 0, 0);
			return;
		}

		if (!obj.blending) {
			composeNoBlend(this, context, onDone);
			return;
		}

		if (!obj.ora.enableWorkers || !window.Worker) {
			compose(this, context, onDone);
			return;
		}

		composeWorkers(this, context, onDone);
	};

	function composeWorkers (oraFile, context, onDone) {
	var	layerCache = [];
	var	startLayer = -1;
	var	worker, i, tmpCanvas;

		for (i = 0; i < oraFile.layers.length; i++) {
			if (oraFile.layers[i].visibility != 'hidden') {
				if (startLayer < 0) {
					startLayer = i;
				}

				layerCache[i] = {
					opacity: oraFile.layers[i].opacity,
					composite: oraFile.layers[i].composite,
					data: oraFile.layers[i]
						.toCanvas(tmpCanvas, oraFile.width, oraFile.height)
						.getContext('2d')
				};
			}
		}

		if (startLayer < 0) {
			if (onDone) {
				onDone();
			}
			return;
		}

		function onTaskDone(e) {
			if (e.data.result) {
//* paint result
				context.putImageData(e.data.result, 0, 0);
				if (onDone) {
					onDone();
				}
				worker.terminate();
				return;
			}

		var	nextLayer = e.data.layer + 1;

			while (nextLayer < oraFile.layers.length && !layerCache[nextLayer]) {
				nextLayer++;
			}

			if (nextLayer >= oraFile.layers.length) {
				worker.postMessage({ done : true });
				return;
			}

		var	nextBatch = {
				layer: nextLayer,
				src : layerCache[nextLayer].data.getImageData(0, 0, oraFile.width, oraFile.height),
				opacity: layerCache[nextLayer].opacity,
				filter: layerCache[nextLayer].composite
			};

			worker.postMessage(nextBatch);
		}

		worker = new Worker(obj.ora.scriptsPath + 'blender.js');
		worker.onmessage = onTaskDone;

	var	initData = {
			layer: startLayer,
			src: layerCache[startLayer].data.getImageData(0, 0, oraFile.width, oraFile.height),
			opacity: layerCache[startLayer].opacity,
			filter: layerCache[startLayer].composite,
			dst: context.getImageData(0, 0, oraFile.width, oraFile.height)
		};

		worker.postMessage(initData);
	}

	function compose (oraFile, context, onDone) {
	var	imgData = context.getImageData(0, 0, oraFile.width, oraFile.height),
			layersCount = oraFile.layers.length,
			layerIdx = 0,
			layer, tmpCanvas;

		while (layersCount > layerIdx) {
			layer = oraFile.layers[layerIdx];

			if (layer && layer.image && (layer.visibility === 'visible' || layer.visibility === undefined)) {
			var	filter = obj.blending[layer.composite] || obj.blending.normal;
			var	srcCanvas = layer.toCanvas(tmpCanvas, oraFile.width, oraFile.height);
			var	src = srcCanvas.getContext('2d').getImageData(0, 0, srcCanvas.width, srcCanvas.height).data;
				obj.blending.blend(src, imgData.data, layer.opacity, filter);
			}

			layerIdx++;
		}

		context.putImageData(imgData, 0, 0);

		if (onDone) {
			onDone();
		}
	}

	function composeNoBlend(oraFile, context, onDone) {
	var	layersCount = oraFile.layers.length;
	var	layerIdx = 0;
	var	layer;

		while (layersCount > layerIdx) {
			layer = oraFile.layers[layerIdx];
			if (layer && layer.image && (layer.visibility === 'visible' || layer.visibility === undefined)) {
				if (layer.opacity === undefined) {
					context.globalAlpha = 1;
				} else {
					context.globalAlpha = layer.opacity;
				}

				context.drawImage(layer.image, layer.x, layer.y);
			}

			layerIdx++;
		}

		if (onDone) {
			onDone();
		}
	}

//* Add a new layer to the image
//* index can optionally specify the position for the new layer
	OraFile.prototype.addLayer = function (name, index) {
	var	layer = new Layer(name, this.width, this.height);
		if (index !== undefined && index < this.layers.length && index >= 0) {
			this.layers.splice(index, 0, layer);
		} else {
			this.layers.push(layer);
		}
		return layer;
	};

//* Create and populate an OraFile object from a blob
//* onload - callback with the loaded object as parameter
	function loadFile(blob, onload, param) {
	var	oraFile = new OraFile();
		oraFile.load(blob, function() {
			onload(oraFile);
		}, param);
	}

	function setZipParams() {
	var	p;
		if (!zip.workerScriptsPath && (p = obj.ora.scriptsPath  )) zip.workerScriptsPath = p;
		if (!zip.useWebWorkers     && (p = obj.ora.enableWorkers)) zip.useWebWorkers     = p;
	}

	obj.ora = {
		Ora : OraFile,
		OraLayer : Layer,
		load: loadFile,

//* enable use of prerendered image instead of layers (if present)
		enablePrerendered : true,
		enableWorkers : true,
		scriptsPath : ''
	};
})(this);