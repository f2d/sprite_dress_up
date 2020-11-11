
//* ORA file parser.
//* Modified version of https://github.com/zsgalusz/ora.js
//* Format spec: https://www.openraster.org/

(function (obj) {
	'use strict';

const	THUMBNAIL_IMAGE_FILE_PATH = 'Thumbnails/thumbnail.png';
const	MERGED_IMAGE_FILE_PATH = 'mergedimage.png';
const	LAYER_IMAGE_FOLDER = 'data';

const	LAYER_DEFAULT_PROPERTIES = {
		name : 'New Layer'
	,	x : 0
	,	y : 0
	,	opacity : 1
	,	composite : 'svg:src-over'
	,	visibility : 'visible'
	};

const	STACK_DEFAULT_PROPERTIES = {
		name : 'New Folder'
	,	x : 0
	,	y : 0
	,	opacity : 1
	,	composite : 'svg:src-over'
	,	visibility : 'visible'
	,	isolation : 'isolate'
	};

const	layerAttributeNames = {
		src : 'src'
	,	name : 'name'
	,	x : 'x'
	,	y : 'y'
	,	opacity : 'opacity'
	,	composite : 'composite-op'
	,	visibility : ['visibility', 'visible']

//* Custom-added properties, not in Open Raster Spec version 0.05:

	,	mask_x : ['mask-x', 'transition-mask-x']
	,	mask_y : ['mask-y', 'transition-mask-y']
	,	mask_src : ['mask-src', 'transition-mask-src']
	,	clipping : ['clipping', 'clipped']
	};

const	stackAttributeNames = {
		name : 'name'
	,	x : 'x'
	,	y : 'y'
	,	opacity : 'opacity'
	,	composite : 'composite-op'
	,	visibility : ['visibility', 'visible']
	,	isolation : 'isolation'

//* Custom-added properties, not in Open Raster Spec version 0.05:

	,	mask_x : ['mask-x', 'transition-mask-x']
	,	mask_y : ['mask-y', 'transition-mask-y']
	,	mask_src : ['mask-src', 'transition-mask-src']
	,	clipping : ['clipping', 'clipped']
	};

const	optionalAttriubutes = [
		'mask_x'
	,	'mask_y'
	,	'mask_src'
	,	'clipping'
	];

const	optionalAttriubuteValueToSkip = [
		'0'
	,	'no'
	,	'none'
	,	'null'
	,	'false'
	,	'hidden'
	,	'disabled'
	,	'undefined'
	];

//* Web API shortcuts:

const	URL_API = window.URL || window.webkitURL;

//* Extract an image from the ora into an Image object:
//* Note: dataURI has length limits.

	function extractImage(path, zipfs, onImageLoad, onDone, onError) {
	var	file = zipfs.find(path);

		if (file) {
		var	onDataLoad = function (data, blob) {
			var	img = new Image();

				img.onload = function (evt) {
					onImageLoad(evt);

					if (onDone) {
						onDone(img);
					}
				};

				img.src = data;
			};

			if (obj.ora.enableImageAsBlob) {
				file.getBlob('image/png', function (blob) {
					onDataLoad(URL_API.createObjectURL(blob), blob);
				});
			} else {
				file.getData64URI('image/png', onDataLoad);
			}
		} else
		if (onError) {
			onError();
		}
	}

//* Resize a canvas to the given size:

	function resize(canvas, width, height, callback) {
		if (
			canvas.width <= width
		&&	canvas.height <= height
		) {
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

		img.onload = function () {
			canvas.width = width;
			canvas.height = height;
			ctx.clearRect(0,0, width, height);
			ctx.drawImage(img, 0,0, width, height);

			callback();
		};

		img.src = oldCanvas;
	}

//* Stack object constructor:

	function Stack(name) {
		for (var key in STACK_DEFAULT_PROPERTIES) {
			this[key] = STACK_DEFAULT_PROPERTIES[key];
		}

		if (name) this.name = name;
	}

//* Layer object constructor:

	function Layer(name, width, height) {
		for (var key in LAYER_DEFAULT_PROPERTIES) {
			this[key] = LAYER_DEFAULT_PROPERTIES[key];
		}

		if (name)   this.name   = name;
		if (width)  this.width  = width;
		if (height) this.height = height;
	}

//* Draw layer onto a new canvas element:

	Layer.prototype.toCanvas = function (canvas, width, height, noOffset) {
	var	tmpCanvas = canvas || document.createElement('canvas');
		tmpCanvas.width  = width  || this.width  || this.image.width;
		tmpCanvas.height = height || this.height || this.image.height;

	var	tmpCtx = tmpCanvas.getContext('2d');
		tmpCtx.clearRect(0,0, tmpCanvas.width, tmpCanvas.height);

		if (noOffset) {
			tmpCtx.drawImage(this.image, 0,0);
		} else {
			tmpCtx.drawImage(this.image, this.x, this.y);
		}

		return tmpCanvas;
	};

//* OraFile object constructor:

	function OraFile(width, height) {
		this.width  = width  || 0;
		this.height = height || 0;
		this.layers = [];
	}

//* Load the file contents from a blob:
//* Note: based on the draft specification from May 2013 + custom extensions from 2018-10-25 + 2019-01-31.
//* http://www.freedesktop.org/wiki/Specifications/OpenRaster/Draft/

	OraFile.prototype.load = function (blob, onload) {
		setZipParams();

	var	fs = new zip.fs.FS();
	var	oraFile = this;

		function loadSrcImage(imageHolder, onCount, onDone) {

			function onImageLoad(evt) {
			var	imageElement = evt.target;

				if (
					imageElement
				&&	imageElement.width > 0
				&&	imageElement.height > 0
				) {
					imageHolder.image  = imageElement;
					imageHolder.width  = imageElement.width;
					imageHolder.height = imageElement.height;
				} else {
					imageHolder.imageError = evt;

					console.log(['Error loading image:', imageElement, evt]);
				}
			};

		var	srcPath;

			if (
				imageHolder
			&&	(srcPath = imageHolder.src)
			&&	fs.find(srcPath)
			) {
				if (onCount) {
					onCount();
				}

				if (obj.ora.preloadImages) {
					extractImage(srcPath, fs, onImageLoad, onDone, onDone);
				} else {
					imageHolder.loadImage = function (onDone, onError) {
						extractImage(srcPath, fs, onImageLoad, onDone, onError);
					};

					if (onDone) {
						onDone();
					}
				}
			}
		}

		function loadLayers(image, onDone) {

		var	onElementCount = function () {
				++elementsCount;
			};

		var	onElementDone = function () {
				if (++elementsLoaded >= elementsCount) {
					onDone();
				}
			};

		var	setAttributesFromElement = function (layerOrStack, element, attributeNamesByKey) {
				for (var key in attributeNamesByKey) {
				var	names = attributeNamesByKey[key];

					(names.map ? names : [names]).map(
						function (name) {
						var	value = element.getAttribute(name);

							if (value !== null) {
								layerOrStack[key] = value;
							}
						}
					);
				}
			};

		var	loadChildLayer = function (layerElement) {
			var	layer = new Layer();

				setAttributesFromElement(layer, layerElement, layerAttributeNames);
				loadSrcImage(layer, onElementCount, onElementDone);

				return layer;
			};

		var	loadChildStack = function (stackElement) {
			var	stack = new Stack();

				setAttributesFromElement(stack, stackElement, stackAttributeNames);
				stack.layers = loadChildren(stackElement, stack);

				return stack;
			};

		var	loadChildren = function (parentElement, parent) {
			var	layers = [];
			var	element = parentElement.firstChild;

				while (element) {
				var	child = null;
				var	tagName = element.tagName;

					if (tagName) {
						tagName = tagName.toLowerCase();
						if (tagName === 'layer') child = loadChildLayer(element); else
						if (tagName === 'stack') child = loadChildStack(element);
					}

					if (child) {
						if (child.mask_src) {
						var	mask = child.mask = {
								'src' : child.mask_src
							,	'x' : child.mask_x || 0
							,	'y' : child.mask_y || 0
							};

							loadSrcImage(mask, onElementCount, onElementDone);
						}

						child.parent = parent;
						layers.push(child);

						onElementDone();
					}

					element = element.nextSibling;
				}

				return layers;
			};

		var	layersCount = oraFile.layersCount = image.getElementsByTagName('layer').length;
		var	stacksCount = oraFile.stacksCount = image.getElementsByTagName('stack').length;
		var	elementsCount = layersCount + stacksCount;
		var	elementsLoaded = 0;

			oraFile.layers = loadChildren(image, oraFile);
		}

		function loadStack(onDone) {
		var	stackFile = fs.find('stack.xml');

			if (!stackFile) {
				oraFile.layers = [];

				onDone();

				return;
			}

		var	onExtract = function (text) {
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
				oraFile.width  = img.getAttribute('w');
				oraFile.height = img.getAttribute('h');

				loadLayers(img, onDone);
			};

//* For some reason Firefox (23.0.1 and earlier) doesn't like getText, so we roll our own:

			stackFile.getBlob('text/xml', function (blob) {
			var	reader = new FileReader();
				reader.onload = function (e) {
					onExtract(e.target.result);
				};
				reader.readAsText(blob, 'UTF-8');
			});
		}

		function loadOra() {

//* Keeping track of finished loading tasks:

		var	stepsDone = 0;
		var	steps = 1;

		var	onCount = function () {
				++steps;
			};

		var	onDone = function () {
				if (++stepsDone >= steps) {
					onload();
				}
			};

		var	thumbnail = oraFile.thumbnail = {src : THUMBNAIL_IMAGE_FILE_PATH};
		var	prerendered = oraFile.prerendered = {src : MERGED_IMAGE_FILE_PATH};

			loadSrcImage(thumbnail, onCount, onDone);
			loadSrcImage(prerendered, onCount, onDone);

			loadStack(onDone);
		}

		fs.importBlob(blob, loadOra);
	};

	OraFile.prototype.save = function (onDone) {
		setZipParams();

	var	fs = new zip.fs.FS();

		fs.root.addText('mimetype', 'image/openraster');

	var	fsDataNode = addNestedNodeToArchive(fs.root, LAYER_IMAGE_FOLDER);

	var	tmpCanvas  = document.createElement('canvas');
	var	xmlDoc     = document.implementation.createDocument(null, null, null);
	var	serializer = new XMLSerializer();

	var	imageElem = xmlDoc.createElement('image');
		imageElem.setAttribute('w', this.width);
		imageElem.setAttribute('h', this.height);
		xmlDoc.appendChild(imageElem);

	var	stackElem = xmlDoc.createElement('stack');
		imageElem.appendChild(stackElem);

//* TODO: save subfolders and layer masks

	var	layerCount = this.layers.length;

		for (
		var	layerIndex = 1;
			layerIndex <= layerCount;
			layerIndex++
		) {
		var	layer = this.layers[layerIndex];
		var	baseName = 'layer' + layerIndex;
		var	fileName = baseName + '.png';
		var	url = layer.toCanvas(null, 0,0, true).toDataURL('image/png');

			fsDataNode.addData64URI(fileName, url);

		var	layerElem = xmlDoc.createElement('layer');
			layerElem.setAttribute('src'         , LAYER_IMAGE_FOLDER + '/' + fileName);
			layerElem.setAttribute('name'        , layer.name || baseName);
			layerElem.setAttribute('x'           , layer.x);
			layerElem.setAttribute('y'           , layer.y);
			layerElem.setAttribute('opacity'     , layer.opacity);
			layerElem.setAttribute('composite-op', layer.composite);
			layerElem.setAttribute('visibility'  , layer.visibility);

			optionalAttriubutes.map(
				function (attrName) {
				var	attrValue = layer[attrName];

					if (
						attrValue
					&&	optionalAttriubuteValueToSkip.indexOf(attrValue) < 0
					) {
						layerElem.setAttribute(attrName, attrValue);
					}
				}
			);

			stackElem.appendChild(layerElem);
		}

		fs.root.addText('stack.xml', serializer.serializeToString(xmlDoc));

		this.drawComposite(tmpCanvas, function () {
			addFileToPathInArchive(fs.root, MERGED_IMAGE_FILE_PATH, tmpCanvas.toDataURL('image/png'));

			resize(tmpCanvas, 256, 256, function () {
				addFileToPathInArchive(fs.root, THUMBNAIL_IMAGE_FILE_PATH, tmpCanvas.toDataURL('image/png'));

				fs.exportBlob(onDone, 'image/openraster');
			});
		});
	};

	function addNestedNodeToArchive(node, path) {
		if (path.split) {
			path = path.split(/\/+/g);
		}

		if (!path.join) {
			return;
		}

		path.map(
			function (subName) {
				node = node.addDirectory(subName || 'no_dirname');
			}
		);
	}

	function addFileToPathInArchive(node, path, content) {
		path = path.split(/\/+/g);

	var	fileName = path.pop() || 'no_filename';

		addNestedNodeToArchive(node, path).addData64URI(fileName, content);
	}

//* Add a new layer to the image:
//* Note: index can optionally specify the position for the new layer.

	OraFile.prototype.addLayer = function (name, index) {
	var	layer = new Layer(name, this.width, this.height);

		if (typeof index !== 'undefined' && index < this.layers.length && index >= 0) {
			this.layers.splice(index, 0, layer);
		} else {
			this.layers.push(layer);
		}

		return layer;
	};

//* Draw the thumbnail into a canvas element:

	OraFile.prototype.drawThumbnail = function (canvas) {
		drawImageOrClearCanvas(canvas, this.thumbnail);
	};

//* Draw the full size prerendered image into a canvas element:

	OraFile.prototype.drawFullSizeImage = function (canvas) {
		drawImageOrClearCanvas(canvas, this.prerendered);
	};

//* Draw the full size composite image from the layer data:
//* Note: uses the prerendered image if present and enabled.

	OraFile.prototype.drawComposite = function (canvas, onDone) {
		canvas.width  = this.width;
		canvas.height = this.height;

		if (!this.layers) {
			if (onDone) {
				onDone();
			}

			return;
		}

	var	ctx = canvas.getContext('2d');

		ctx.clearRect(0,0, canvas.width, canvas.height);

		if (!obj.blending) {
			composeNoBlend(this, ctx, onDone);

			return;
		}

		if (!obj.ora.enableWorkers || !window.Worker) {
			composeBlending(this, ctx, onDone);

			return;
		}

		composeWorkers(this, ctx, onDone);
	};

	function drawImageOrClearCanvas(canvas, image) {
	var	ctx = canvas.getContext('2d');

		if (
			image
		&&	image.width > 0
		&&	image.height > 0
		) {
			canvas.width  = image.width;
			canvas.height = image.height;
			ctx.clearRect(0,0, canvas.width, canvas.height);
			ctx.drawImage(image, 0,0);
		} else {
			ctx.clearRect(0,0, canvas.width, canvas.height);
		}
	};

	function isLayerDrawable(layer) {
		return (
			layer
		&&	layer.image
		&&	(
				layer.visibility === 'visible'
			||	typeof layer.visibility === 'undefined'
			)
		);
	}

	function composeBlending(oraFile, ctx, onDone) {
	var	imgData = ctx.getImageData(0,0, oraFile.width, oraFile.height);
	var	layersCount = oraFile.layers.length;
	var	layerIndex = 0;

		while (layersCount > layerIndex) {
		var	layer = oraFile.layers[layerIndex];

			if (isLayerDrawable(layer)) {

			var	tmpCanvas;
			var	filter = obj.blending[layer.composite] || obj.blending.normal;
			var	srcCanvas = layer.toCanvas(tmpCanvas, oraFile.width, oraFile.height);
			var	srcCtx = srcCanvas.getContext('2d');
			var	src = srcCtx.getImageData(0,0, srcCanvas.width, srcCanvas.height).data;

				obj.blending.blend(src, imgData.data, layer.opacity, filter);
			}

			layerIndex++;
		}

		ctx.putImageData(imgData, 0,0);

		if (onDone) {
			onDone();
		}
	}

	function composeNoBlend(oraFile, ctx, onDone) {
	var	layersCount = oraFile.layers.length;
	var	layerIndex = 0;

		while (layersCount > layerIndex) {
		var	layer = oraFile.layers[layerIndex];

			if (isLayerDrawable(layer)) {

				if (typeof layer.opacity === 'undefined') {
					ctx.globalAlpha = 1;
				} else {
					ctx.globalAlpha = layer.opacity;
				}

				ctx.drawImage(layer.image, layer.x, layer.y);
			}

			layerIndex++;
		}

		if (onDone) {
			onDone();
		}
	}

	function composeWorkers(oraFile, ctx, onDone) {
	var	layerCount = oraFile.layers.length;
	var	layerCache = [];
	var	startLayer = -1;
	var	worker, tmpCanvas;

		for (
		var	layerIndex = 1;
			layerIndex <= layerCount;
			layerIndex++
		) {
		var	layer = oraFile.layers[layerIndex];

			if (isLayerDrawable(layer)) {

				if (startLayer < 0) {
					startLayer = layerIndex;
				}

				layerCache[layerIndex] = {
					opacity :   layer.opacity
				,	composite : layer.composite
				,	data : (
						layer
						.toCanvas(tmpCanvas, oraFile.width, oraFile.height)
						.getContext('2d')
					)
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
				ctx.putImageData(e.data.result, 0,0);

				if (onDone) {
					onDone();
				}

				worker.terminate();

				return;
			}

		var	nextLayer = e.data.layer + 1;

			while (
				nextLayer < oraFile.layers.length
			&&	!layerCache[nextLayer]
			) {
				nextLayer++;
			}

			if (nextLayer >= oraFile.layers.length) {
				worker.postMessage({ done : true });

				return;
			}

		var	layer = layerCache[nextLayer];
		var	nextBatch = {
				layer   : nextLayer
			,	src     : layer.data.getImageData(0,0, oraFile.width, oraFile.height)
			,	opacity : layer.opacity
			,	filter  : layer.composite
			};

			worker.postMessage(nextBatch);
		}

		worker = new Worker(obj.ora.scriptsPath + 'blender.js');
		worker.onmessage = onTaskDone;

	var	layer = layerCache[startLayer];
	var	initData = {
			layer   : startLayer
		,	src     : layer.data.getImageData(0,0, oraFile.width, oraFile.height)
		,	opacity : layer.opacity
		,	filter  : layer.composite
		,	dst     : ctx.getImageData(0,0, oraFile.width, oraFile.height)
		};

		worker.postMessage(initData);
	}

	function setZipParams() {
		if (typeof zip === 'object') {
			if (typeof obj.ora.enableWorkers !== 'undefined') {
				zip.useWebWorkers = !!obj.ora.enableWorkers;
			}

			if (
				zip.useWebWorkers
			&&	zip.workerScripts === null
			&&	zip.workerScriptsPath === null
			&&	typeof obj.ora.scriptsPath !== 'undefined'
			) {
				zip.workerScriptsPath = obj.ora.scriptsPath;
			}
		}
	}

//* Create and populate an OraFile object from a blob:
//* Note: onload = callback with the loaded object as parameter.

	function loadFile(blob, onload) {
	var	oraFile = new OraFile();

		oraFile.load(blob, function () {
			onload(oraFile);
		});
	}

	obj.ora = {

//* Public methods:

		Ora : OraFile,
		OraLayer : Layer,
		OraStack : Stack,
		load : loadFile,

//* Public parameters:

		enableImageAsBlob : true,
		enableWorkers : true,
		preloadImages : true,
		scriptsPath : '',
	};
})(this);
