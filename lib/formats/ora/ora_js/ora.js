
//* ORA file parser.
//* Modified version of https://github.com/zsgalusz/ora.js
//* Format spec: https://www.openraster.org/

(function (global) {

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

const	LAYER_ATTRIBUTE_NAMES_BY_KEY = {
		src : 'src'
	,	name : 'name'
	,	x : 'x'
	,	y : 'y'
	,	opacity : 'opacity'
	,	composite : 'composite-op'
	,	visibility : ['visibility', 'visible']

//* Custom-added properties, not in Open Raster Spec version 0.05:

	,	clipping : ['clipping', 'clipped']
	,	composite_alpha : ['alpha-composite-op', 'composite-alpha']
	,	composite_color : ['color-composite-op', 'composite-color']
	,	mask_src : ['mask-src', 'transition-mask-src']
	,	mask_x : ['mask-x', 'transition-mask-x']
	,	mask_y : ['mask-y', 'transition-mask-y']
	};

const	STACK_ATTRIBUTE_NAMES_BY_KEY = {
		name : 'name'
	,	x : 'x'
	,	y : 'y'
	,	opacity : 'opacity'
	,	composite : 'composite-op'
	,	visibility : ['visibility', 'visible']
	,	isolation : 'isolation'

//* Custom-added properties, not in Open Raster Spec version 0.05:

	,	clipping : ['clipping', 'clipped']
	,	composite_alpha : ['alpha-composite-op', 'composite-alpha']
	,	composite_color : ['color-composite-op', 'composite-color']
	,	mask_src : ['mask-src', 'transition-mask-src']
	,	mask_x : ['mask-x', 'transition-mask-x']
	,	mask_y : ['mask-y', 'transition-mask-y']
	};

const	OPTIONAL_ATTRIBUTE_KEYS = [
		'clipping'
	,	'composite_alpha'
	,	'composite_color'
	,	'mask_src'
	,	'mask_x'
	,	'mask_y'
	];

const	FALSY_VALUES = [
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

const	URL_API = global.URL || global.webkitURL;

//* Extract an image from the ora into an Image object:
//* Note: dataURI has length limits.

	function extractImage(path, zipfs, onImageLoad, onDone, onError) {
	const	file = zipfs.find(path);

		if (file) {
		const	onExtract = function (src) {
			const	img = new Image();

				img.onload = function (evt) {
					onImageLoad(evt);

					if (onDone) {
						onDone(img);
					}
				};

				img.src = src;
			};

			if (global.ora.enableImageAsBlob) {
				file.getBlob('image/png', function (blob) {
					onExtract(URL_API.createObjectURL(blob));
				});
			} else {
				file.getData64URI('image/png', function (dataURI) {
					onExtract(dataURI);
				});
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

	const	ctx = canvas.getContext('2d');
	const	oldCanvas = canvas.toDataURL('image/png');
	const	img = new Image();
	const	aspect = canvas.width / canvas.height;

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
	const	tmpCanvas = canvas || document.createElement('canvas');
		tmpCanvas.width  = width  || this.width  || this.image.width;
		tmpCanvas.height = height || this.height || this.image.height;

	const	tmpCtx = tmpCanvas.getContext('2d');
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

	OraFile.prototype.load = function (blob, onLoadComplete, onError) {

		function loadSrcImage(imageHolder, onCount, onDone) {

			function onImageLoad(evt) {
			const	imageElement = evt.target;

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

		const	srcPath = imageHolder.src;

			if (
				!srcPath
			||	!fs.find(srcPath)
			) {
				return;
			}

			if (onCount) {
				onCount();
			}

			if (global.ora.preloadImages) {
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

		function loadLayers(image, onDone) {

		const	onElementCount = function () {
				++elementsCount;
			};

		const	onElementDone = function () {
				if (++elementsLoaded >= elementsCount) {
					onDone();
				}
			};

		const	setAttributesFromElement = function (layerOrStack, element, attributeNamesByKey) {
				for (var key in attributeNamesByKey) {
				const	names = attributeNamesByKey[key];

					(names.map ? names : [names]).map(
						function (name) {
						const	value = element.getAttribute(name);

							if (value !== null) {
								layerOrStack[key] = value;
							}
						}
					);
				}
			};

		const	loadChildLayer = function (layerElement) {
			const	layer = new Layer();

				setAttributesFromElement(layer, layerElement, LAYER_ATTRIBUTE_NAMES_BY_KEY);
				loadSrcImage(layer, onElementCount, onElementDone);

				return layer;
			};

		const	loadChildStack = function (stackElement) {
			const	stack = new Stack();

				setAttributesFromElement(stack, stackElement, STACK_ATTRIBUTE_NAMES_BY_KEY);
				stack.layers = loadChildren(stackElement, stack);

				return stack;
			};

		const	loadChildren = function (parentElement, parent) {
			const	layers = [];
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
						const	mask = child.mask = {
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

		const	layersCount = oraFile.layersCount = image.getElementsByTagName('layer').length;
		const	stacksCount = oraFile.stacksCount = image.getElementsByTagName('stack').length;
		var	elementsCount = layersCount + stacksCount;
		var	elementsLoaded = 0;

			oraFile.layers = loadChildren(image, oraFile);
		}

		function loadStack(onDone) {
		const	stackFile = fs.find('stack.xml');

			if (!stackFile) {
				oraFile.layers = [];

				onDone();

				return;
			}

		const	onExtract = function (text) {
			var	xml;

//* http://stackoverflow.com/questions/649614/xml-parsing-of-a-variable-string-in-javascript

				if (global.DOMParser) {
					xml = ( new global.DOMParser() ).parseFromString(text, 'text/xml');
				} else {
					xml = new global.ActiveXObject('Microsoft.XMLDOM');
					xml.async = false;
					xml.loadXML(text);
				}

			const	img = xml.getElementsByTagName('image')[0];
				oraFile.width  = img.getAttribute('w');
				oraFile.height = img.getAttribute('h');

				loadLayers(img, onDone);
			};

//* For some reason Firefox (23.0.1 and earlier) doesn't like getText, so we roll our own:

			stackFile.getBlob('text/xml', function (blob) {
			const	reader = new FileReader();
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

		const	onCount = function () {
				++steps;
			};

		const	onDone = function () {
				if (++stepsDone >= steps) {
					onLoadComplete(oraFile);
				}
			};

		const	thumbnail = oraFile.thumbnail = {src : THUMBNAIL_IMAGE_FILE_PATH};
		const	prerendered = oraFile.prerendered = {src : MERGED_IMAGE_FILE_PATH};

			loadSrcImage(thumbnail, onCount, onDone);
			loadSrcImage(prerendered, onCount, onDone);

			loadStack(onDone);
		}

	const	fs = getNewZipFS();

		if (!fs) {
			if (onError) {
				onError();
			}

			return;
		}

	const	oraFile = this;

		fs.importBlob(blob, loadOra, onError);
	};

	OraFile.prototype.save = function (onDone, onError) {

	const	fs = getNewZipFS();

		if (!fs) {
			if (onError) {
				onError();
			}

			return;
		}

		fs.root.addText('mimetype', 'image/openraster');

	const	fsDataNode = addNestedNodeToArchive(fs.root, LAYER_IMAGE_FOLDER);

	const	tmpCanvas  = document.createElement('canvas');
	const	xmlDoc     = document.implementation.createDocument(null, null, null);
	const	serializer = new XMLSerializer();

	const	imageElem = xmlDoc.createElement('image');
		imageElem.setAttribute('w', this.width);
		imageElem.setAttribute('h', this.height);
		xmlDoc.appendChild(imageElem);

	const	stackElem = xmlDoc.createElement('stack');
		imageElem.appendChild(stackElem);

//* TODO: save subfolders and layer masks

	const	layerCount = this.layers.length;

		for (
		var	layerIndex = 1;
			layerIndex <= layerCount;
			layerIndex++
		) {
		const	layer = this.layers[layerIndex];
		const	baseName = 'layer' + layerIndex;
		const	fileName = baseName + '.png';
		const	url = layer.toCanvas(null, 0,0, true).toDataURL('image/png');

			fsDataNode.addData64URI(fileName, url);

		const	layerElem = xmlDoc.createElement('layer');
			layerElem.setAttribute('src'         , LAYER_IMAGE_FOLDER + '/' + fileName);
			layerElem.setAttribute('name'        , layer.name || baseName);
			layerElem.setAttribute('x'           , layer.x);
			layerElem.setAttribute('y'           , layer.y);
			layerElem.setAttribute('opacity'     , layer.opacity);
			layerElem.setAttribute('composite-op', layer.composite);
			layerElem.setAttribute('visibility'  , layer.visibility);

			OPTIONAL_ATTRIBUTE_KEYS.map(
				function (attrName) {
				const	attrValue = layer[attrName];

					if (
						attrValue
					&&	FALSY_VALUES.indexOf(attrValue) < 0
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

	const	fileName = path.pop() || 'no_filename';

		addNestedNodeToArchive(node, path).addData64URI(fileName, content);
	}

//* Add a new layer to the image:
//* Note: index can optionally specify the position for the new layer.

	OraFile.prototype.addLayer = function (name, index) {
	const	layer = new Layer(name, this.width, this.height);

		if (
			typeof index !== 'undefined'
		&&	index >= 0
		&&	index < this.layers.length
		) {
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

	const	ctx = canvas.getContext('2d');

		ctx.clearRect(0,0, canvas.width, canvas.height);

		if (!global.blending) {
			composeNoBlend(this, ctx, onDone);

			return;
		}

		if (!global.ora.enableWorkers || !global.Worker) {
			composeBlending(this, ctx, onDone);

			return;
		}

		composeWorkers(this, ctx, onDone);
	};

	function drawImageOrClearCanvas(canvas, image) {
	const	ctx = canvas.getContext('2d');

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
	const	imgData = ctx.getImageData(0,0, oraFile.width, oraFile.height);
	const	layersCount = oraFile.layers.length;
	var	tmpCanvas;

		for (
		var	layerIndex = 0;
			layerIndex < layerCount;
			layerIndex++
		) {
		const	layer = oraFile.layers[layerIndex];

			if (isLayerDrawable(layer)) {
			const	filter = global.blending[layer.composite] || global.blending.normal;
			const	srcCanvas = layer.toCanvas(tmpCanvas, oraFile.width, oraFile.height);
			const	srcCtx = srcCanvas.getContext('2d');
			const	src = srcCtx.getImageData(0,0, srcCanvas.width, srcCanvas.height).data;

				global.blending.blend(src, imgData.data, layer.opacity, filter);
			}
		}

		ctx.putImageData(imgData, 0,0);

		if (onDone) {
			onDone();
		}
	}

	function composeNoBlend(oraFile, ctx, onDone) {
	const	layersCount = oraFile.layers.length;

		for (
		var	layerIndex = 0;
			layerIndex < layerCount;
			layerIndex++
		) {
		const	layer = oraFile.layers[layerIndex];

			if (isLayerDrawable(layer)) {

				if (typeof layer.opacity === 'undefined') {
					ctx.globalAlpha = 1;
				} else {
					ctx.globalAlpha = layer.opacity;
				}

				ctx.drawImage(layer.image, layer.x, layer.y);
			}
		}

		if (onDone) {
			onDone();
		}
	}

	function composeWorkers(oraFile, ctx, onDone) {
	const	layerCount = oraFile.layers.length;
	const	layerCache = [];
	var	startLayer = -1;
	var	worker, tmpCanvas;

		for (
		var	layerIndex = 1;
			layerIndex <= layerCount;
			layerIndex++
		) {
		const	layer = oraFile.layers[layerIndex];

			if (isLayerDrawable(layer)) {

				if (startLayer < 0) {
					startLayer = layerIndex;
				}

				layerCache[layerIndex] = {
					opacity :   layer.opacity
				,	composite : layer.composite
				,	ctx : (
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

		const	layer = layerCache[nextLayer];
		const	nextBatch = {
				layer   : nextLayer
			,	src     : layer.ctx.getImageData(0,0, oraFile.width, oraFile.height)
			,	opacity : layer.opacity
			,	filter  : layer.composite
			};

			worker.postMessage(nextBatch);
		}

		worker = new Worker(global.ora.scriptsPath + 'blender.js');
		worker.onmessage = onTaskDone;

	const	layer = layerCache[startLayer];
	const	initData = {
			layer   : startLayer
		,	src     : layer.ctx.getImageData(0,0, oraFile.width, oraFile.height)
		,	opacity : layer.opacity
		,	filter  : layer.composite
		,	dst     : ctx.getImageData(0,0, oraFile.width, oraFile.height)
		};

		worker.postMessage(initData);
	}

	function getNewZipFS() {
	const	zip = global.zip;

		if (
			zip !== null
		&&	typeof zip === 'object'
		) {
			if (global.ora.enableWorkers !== null) {
				zip.useWebWorkers = !!global.ora.enableWorkers;
			}

			if (
				zip.useWebWorkers
			&&	zip.workerScripts === null
			&&	zip.workerScriptsPath === null
			&&	global.ora.scriptsPath !== null
			) {
				zip.workerScriptsPath = global.ora.scriptsPath;
			}

			return new zip.fs.FS();
		}

		return null;
	}

//* Create and populate an OraFile object from a blob:
//* Note: onLoad = callback function with the loaded object as parameter.

	function loadFile(blob, onLoad, onError) {
	const	oraFile = new OraFile();

		oraFile.load(blob, onLoad, onError);
	}

	global.ora = {

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
