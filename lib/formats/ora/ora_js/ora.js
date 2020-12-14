
//* ORA file parser.
//* Modified version of https://github.com/zsgalusz/ora.js
//* Based on spec version 0.0.5 + custom extensions.
//* Format draft: https://www.freedesktop.org/wiki/Specifications/OpenRaster/Draft/
//* Format spec: https://www.openraster.org/

(function (global) {

	'use strict';

const	ORA_VERSION = '0.0.5';
const	XML_CUSTOM_NAMESPACE = 'test';
const	XML_CUSTOM_NAMESPACE_URL = 'https://2draw.me/sprite_dress_up/';
const	XML_COMMENT_TEXT = 'Created with Sprite Dress Up';

const	THUMBNAIL_IMAGE_FILE_PATH = 'Thumbnails/thumbnail.png';
const	MERGED_IMAGE_FILE_PATH = 'mergedimage.png';
const	LAYER_IMAGE_FOLDER = 'data';
const	LAYER_IMAGE_PREFIX = 'layer';
const	MASK_IMAGE_PREFIX = 'mask';

const	LAYER_DEFAULT_PROPERTIES = {
		name : ''
	,	x : 0
	,	y : 0
	,	opacity : 1
	,	composite : 'svg:src-over'
	,	visibility : 'visible'
	};

const	STACK_DEFAULT_PROPERTIES = {
		name : ''
	,	x : 0
	,	y : 0
	,	opacity : 1
	,	composite : 'svg:src-over'
	,	visibility : 'visible'
	,	isolation : 'isolate'
	,	layers : null
	};

const	LAYER_ATTRIBUTE_NAMES_BY_KEY = {
		src : 'src'
	,	name : 'name'
	,	x : 'x'
	,	y : 'y'
	,	opacity : 'opacity'
	,	composite : 'composite-op'
	,	visibility : ['visibility', 'visible']

//* Custom-added properties, not in spec version 0.0.5:

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

//* Custom-added properties, not in spec version 0.0.5:

	,	clipping : ['clipping', 'clipped']
	,	composite_alpha : ['alpha-composite-op', 'composite-alpha']
	,	composite_color : ['color-composite-op', 'composite-color']
	,	mask_src : ['mask-src', 'transition-mask-src']
	,	mask_x : ['mask-x', 'transition-mask-x']
	,	mask_y : ['mask-y', 'transition-mask-y']
	};

//* Custom-added properties, not in spec version 0.0.5:

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

//* XSLT describes how we want to modify the XML - indent everything:
//* Source: https://stackoverflow.com/a/47317538

const	XML_PRETTY_PRINT_XSLT = [
		'<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">'
	,	'  <xsl:strip-space elements="*"/>'
//* Change to just text() to strip space in text nodes:
	,	'  <xsl:template match="para[content-style][not(text())]">'
	,	'    <xsl:value-of select="normalize-space(.)"/>'
	,	'  </xsl:template>'
	,	'  <xsl:template match="node()|@*">'
	,	'    <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>'
	,	'  </xsl:template>'
	,	'  <xsl:output omit-xml-declaration="yes" indent="yes"/>'
	,	'</xsl:stylesheet>'
	].join('\n');

//* OraFile object constructor:

	function OraFile(width, height) {
		this.width  = width  || 0;
		this.height = height || 0;
		this.layers = [];
	}

//* Stack object constructor:

	function Stack(name) {
	const	element = arguments[0];

		for (const key in STACK_DEFAULT_PROPERTIES) {
			this[key] = STACK_DEFAULT_PROPERTIES[key];
		}

		if (isStackElement(element)) {
			setAttributesFromElement(this, element, STACK_ATTRIBUTE_NAMES_BY_KEY);
		} else {
			this.name = isNullOrUndefined(name) ? 'New Folder' : String(name);
		}
	}

//* Layer object constructor:

	function Layer(name, width, height) {
	const	element = arguments[0];

		for (const key in LAYER_DEFAULT_PROPERTIES) {
			this[key] = LAYER_DEFAULT_PROPERTIES[key];
		}

		if (isLayerElement(element)) {
			setAttributesFromElement(this, element, LAYER_ATTRIBUTE_NAMES_BY_KEY);
		} else {
			this.name = isNullOrUndefined(name) ? 'New Layer' : String(name);

			if (width)  this.width  = width;
			if (height) this.height = height;
		}
	}

//* Load the file contents from a blob:

	OraFile.prototype.load = function (blob, onComplete, onError, onProgress) {

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

					console.error('Image is empty or does not exist:', [imageElement, 'Event:', evt]);
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

		function loadLayers(layeredImage, onCount, onDone) {

			function loadChildren(parentElement, parent) {
			const	layers = [];
			var	element = parentElement.firstChild;

				while (element) {
				var	child = null;

					if (isStackElement(element)) {
						child = new Stack(element);
						child.layers = loadChildren(element, child);
					} else
					if (isLayerElement(element)) {
						child = new Layer(element);
						loadSrcImage(child, onCount, onDone);
					}

					if (child) {
						if (child.mask_src) {
						const	mask = child.mask = {
								'src' : child.mask_src
							,	'x' : child.mask_x || 0
							,	'y' : child.mask_y || 0
							};

							loadSrcImage(mask, onCount, onDone);
						}

						child.parent = parent;
						layers.push(child);
					}

					element = element.nextSibling;
				}

				return layers;
			}

			oraFile.layersCount = layeredImage.getElementsByTagName('layer').length;
			oraFile.stacksCount = layeredImage.getElementsByTagName('stack').length;
			oraFile.layers = loadChildren(layeredImage, oraFile);
		}

		function loadStack(onCount, onDone) {
		const	stackFile = fs.find('stack.xml');

			if (!stackFile) {
				oraFile.layers = [];

				onDone();

				return;
			}

		const	onExtract = function (evt) {
			const	text = evt.target.result;
			const	xml = getXMLDOMFromText(text);
			const	layeredImage = xml.getElementsByTagName('image')[0];
				oraFile.width  = layeredImage.getAttribute('w');
				oraFile.height = layeredImage.getAttribute('h');
				oraFile.xmlDoc = xml;

				loadLayers(layeredImage, onCount, onDone);

				onDone();
			};

//* Old Firefox (23.0.1 and earlier) doesn't like getText, so we roll our own:

			stackFile.getBlob('text/xml', function (blob) {
			const	reader = new global.FileReader;
				reader.onerror = onError;
				reader.onload = onExtract;
				reader.readAsText(blob, 'UTF-8');
			});
		}

		function loadOra() {
		const	thumbnail = oraFile.thumbnail = {src : THUMBNAIL_IMAGE_FILE_PATH};
		const	prerendered = oraFile.prerendered = {src : MERGED_IMAGE_FILE_PATH};

			loadSrcImage(thumbnail, onCount, onDone);
			loadSrcImage(prerendered, onCount, onDone);

			loadStack(onCount, onDone);
		}

//* Keeping track of finished loading tasks:

	var	stepsDone = 0;
	var	stepsTotal = 1;

	const	onCount = function () {
			++stepsTotal;
		};

	const	onDone = function () {
			++stepsDone;

			if (onProgress) {
				onProgress(stepsDone, stepsTotal);
			}

			if (stepsDone >= stepsTotal) {
				onComplete(oraFile);
			}
		};

//* Start loading:

	const	oraFile = this;
	const	fs = oraFile.fs = getNewZipFS();
		fs.importBlob(blob, loadOra, onError);
	};

//* Saving to a file:

	OraFile.prototype.saveOld = function (onDone, onError, onProgress) {
		this.fs.exportBlob(onDone, onProgress, onError);
	};

	OraFile.prototype.save = function (onDone, onError, onProgress) {

		function addLayers(parentElement, layers) {
			for (var index in layers) {
			const	node = layers[index];
			const	isLayer = node instanceof Layer;
			const	isStack = node instanceof Stack;

				if (!isLayer && !isStack) {
					continue;
				}

			const	attrNamesDict = (
					isLayer
					? LAYER_ATTRIBUTE_NAMES_BY_KEY
					: STACK_ATTRIBUTE_NAMES_BY_KEY
				);

			const	attrDefaultsDict = (
					isLayer
					? LAYER_DEFAULT_PROPERTIES
					: STACK_DEFAULT_PROPERTIES
				);

			const	element = xmlDoc.createElement(
					isLayer
					? 'layer'
					: 'stack'
				);

			const	mask = node.mask;

				if (mask) {
					if (!node.mask_x) node.mask_x = mask.x;
					if (!node.mask_y) node.mask_y = mask.y;
				}

				for (const key in attrNamesDict) {
				const	attrValue = node[key];

					if (
						!isNullOrUndefined(attrValue)
					&&	(
							OPTIONAL_ATTRIBUTE_KEYS.indexOf(key) < 0
							? attrValue !== attrDefaultsDict[key]
							: FALSY_VALUES.indexOf(String(attrValue)) < 0
						)
					) {
					const	attrName = getAttributeNameFromDict(attrNamesDict, key);
						element.setAttribute(attrName, attrValue);
					}
				}

			const	otherDict = node.otherAttributes;

				if (otherDict) {
					for (var attrName in otherDict) {
					const	attrValue = otherDict[attrName];

						if (!isNullOrUndefined(attrValue)) {
							element.setAttribute(attrName, attrValue);
						}
					}
				}

				if (isLayer && node.image) {
					addLayerImage(
						element
					,	node.toCanvas()
					,	attrNamesDict
					,	'src'
					,	LAYER_IMAGE_PREFIX + (++layerImageIndex)
					);
				}

				if (mask) {
					addLayerImage(
						element
					,	node.maskToCanvas()
					,	attrNamesDict
					,	'mask_src'
					,	MASK_IMAGE_PREFIX + (++maskImageIndex)
					);
				}

				if (isStack) {
					addLayers(element, node.layers);
				}

				parentElement.appendChild(element);
			}
		}

		function addLayerImage(element, canvas, attrNamesDict, attrNameKey, srcBaseName) {
		const	fileName = srcBaseName + '.png';
		const	attrName = getAttributeNameFromDict(attrNamesDict, attrNameKey);
			element.setAttribute(attrName, LAYER_IMAGE_FOLDER + '/' + fileName);

		const	content = canvas.toDataURL('image/png');
			addFileToArchiveNode(fsDataNode, fileName, content);
		}

	const	oraFile = this;
	const	fs = getNewZipFS();
		fs.root.addText('mimetype', 'image/openraster');

//* Don't compress mimetype and PNGs:

		if (typeof fs.compressionLevelByFilePath === 'object') {
			fs.compressionLevelByFilePath['mimetype'] = 0;
		}

		if (typeof fs.compressionLevelDefault !== 'undefined') {
			fs.compressionLevelDefault = 0;
		}

	const	fsDataNode = addNestedNodeToArchive(fs.root, LAYER_IMAGE_FOLDER);

	const	canvas = document.createElement('canvas');
	const	xmlDoc = document.implementation.createDocument(null, null, null);

	const	imageElem = xmlDoc.createElement('image');

		if (XML_CUSTOM_NAMESPACE) {
			imageElem.setAttribute('xmlns:' + XML_CUSTOM_NAMESPACE, XML_CUSTOM_NAMESPACE_URL);
		}

		imageElem.setAttribute('version', ORA_VERSION);
		imageElem.setAttribute('w', oraFile.width);
		imageElem.setAttribute('h', oraFile.height);
		xmlDoc.appendChild(imageElem);

	var	layerImageIndex = 0;
	var	maskImageIndex = 0;

		if (
			oraFile.layers.length <= 1
		&&	isTrivialStack(oraFile.layers[0])
		) {
			addLayers(imageElem, oraFile.layers);
		} else {
		const	rootStack = new Stack('root');
			rootStack.layers = oraFile.layers;

			addLayers(imageElem, [rootStack]);
		}

	const	xmlFileText = [
			'<?xml version="1.0" encoding="UTF-8"?>'
		,	'<!-- ' + XML_COMMENT_TEXT + ' (' + XML_CUSTOM_NAMESPACE_URL + ') -->'
		,	getPrettyPrintedXML(xmlDoc)
		].join('\n');

	const	addExistingImage = function (image) {
			if (
				image
			&&	isImageElement(image = image.image || image)
			) {
				imageToCanvas(image, canvas);
				addImageFileFromCanvas();

				return true;
			}

			return false;
		};

	const	addImageFileFromCanvas = function (newCanvas) {
			imageContentFromCanvasToCallback(newCanvas || canvas, doNextStep);
		};

	const	addImageFileToArchive = function (path, content) {
			addFileToArchivePath(fs.root, path, content);
			doNextStep();
		};

	const	stepsToDo = [
			function () {
				addExistingImage(oraFile.prerendered)
				|| oraFile.drawComposite(canvas, addImageFileFromCanvas);
			},

			function (content) {
				addImageFileToArchive(MERGED_IMAGE_FILE_PATH, content);
			},

			function () {
				addExistingImage(oraFile.thumbnail)
				|| addImageFileFromCanvas(getResizedCanvas(canvas, 256, 256));
			},

			function (content) {
				addImageFileToArchive(THUMBNAIL_IMAGE_FILE_PATH, content);
			},

			function () {

//* Compress XML text file:

				if (typeof fs.compressionLevelByFilePath === 'object') {
					fs.compressionLevelByFilePath['stack.xml'] = 6;
				}

				fs.root.addText('stack.xml', xmlFileText);

				if (typeof fs.setMimeType === 'function') {
					fs.setMimeType('image/openraster');
				}

				fs.exportBlob(onDone, onProgress, onError);
			}
		];

	const	doNextStep = function () {
			try {
				if (stepsToDo.length > 0) {
					return stepsToDo.shift().apply(oraFile, arguments);
				}
			} catch (error) {
				console.error(error);

				if (onError) {
					onError(error);
				}
			}
		};

		doNextStep();
	};

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

		if (!(
			this.layers
		&&	this.layers.length > 0
		)) {
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

//* Draw layer onto a new canvas element:

	Layer.prototype.toCanvas = function (canvas, width, height, ignoreOffset) {
	const	image = this.image;

		if (!image) {
			return;
		}

		if (!arguments.length) {
			return imageToCanvas(image);
		}

		return imageToCanvas(
			image
		,	canvas
		,	width  || this.width
		,	height || this.height
		,	ignoreOffset ? 0 : this.x
		,	ignoreOffset ? 0 : this.y
		);
	};

	Layer.prototype.maskToCanvas =
	Stack.prototype.maskToCanvas = function (canvas, width, height, ignoreOffset) {
		if (!this.mask) {
			return;
		}

	const	image = this.mask.image;

		if (!image) {
			return;
		}

		if (!arguments.length) {
			return imageToCanvas(image);
		}

		return imageToCanvas(
			image
		,	canvas
		,	width  || this.width
		,	height || this.height
		,	ignoreOffset ? 0 : this.x
		,	ignoreOffset ? 0 : this.y
		);
	};

//* Helper functions:

//* Create type-checking functions, e.g. "isString()" or "isImageElement()":
//* Source: https://stackoverflow.com/a/17772086

	[
		'Array',
		'Blob',
		'String',
		'HTMLImageElement',
	].forEach(
		function (typeName) {
			window[
				'is' + typeName.replace('HTML', '')
			] = function (value) {
				return (toString.call(value).slice(-1 - typeName.length, -1) === typeName);
			};
		}
	);

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

	function isNullOrUndefined(value) { return (typeof value === 'undefined' || value === null); }
	function isLayerElement(element) { return (element && element.tagName && element.tagName.toLowerCase() === 'layer'); }
	function isStackElement(element) { return (element && element.tagName && element.tagName.toLowerCase() === 'stack'); }

	function isTrivialStack(stack) {
		for (const key in stack) {
			if (
				key === 'name'
			||	key === 'layers'
			||	typeof stack[key] === 'function'
			) {
				continue;
			}

			if (
				!(key in STACK_DEFAULT_PROPERTIES)
			||	(
					typeof stack[key] !== 'undefined'
				&&	stack[key] !== STACK_DEFAULT_PROPERTIES[key]
				)
			) {
				return false;
			}
		}

		return true;
	}

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

//* Use of apply() with 'new' operator:
//* Source: https://stackoverflow.com/a/8843181

	function getNewGlobal() {
	var	func = global[arguments[0]];

		return new (arguments.length > 1 ? func.bind.apply(func, arguments) : func);
	}

	function getTextFromXMLDOM(xml) {
		return getNewGlobal('XMLSerializer').serializeToString(xml);
	}

	function getXMLDOMFromText(text) {
	var	xml;

//* https://stackoverflow.com/questions/649614/xml-parsing-of-a-variable-string-in-javascript

		if (global.DOMParser) {
			xml = getNewGlobal('DOMParser').parseFromString(text, 'text/xml');
		} else {
			xml = new global.ActiveXObject('Microsoft.XMLDOM');
			xml.async = false;
			xml.loadXML(text);
		}

		return xml;
	}

//* Formatting XML:
//* Source: https://stackoverflow.com/a/47317538

	function getPrettyPrintedXML(source) {

//* Old Firefox (e.g. v56) throws an empty exception at importStylesheet; without a try-catch it just silently stops.

		try {
			if (global.XSLTProcessor) {
			const	xsltDoc = getXMLDOMFromText(XML_PRETTY_PRINT_XSLT);
			const	xsltProcessor = getNewGlobal('XSLTProcessor');
				xsltProcessor.importStylesheet(xsltDoc);
			const	xmlDoc = (
					isString(source)
					? getXMLDOMFromText(source)
					: source
				);
			const	resultDoc = xsltProcessor.transformToDocument(xmlDoc);
			const	resultText = getTextFromXMLDOM(resultDoc);

				return resultText;
			}
		} catch (error) {
			if (error && error.message) {
				console.error(error);
			}
		}

		return (
			isString(source)
			? source
			: getTextFromXMLDOM(source)
		);
	}

	function getAttributeNameFromDict(dict, key) {
	var	value = dict[key];

		if (isArray(value)) {
			value = value[0];
		}

		if (
			XML_CUSTOM_NAMESPACE
		&&	global.ora.prefixCustomAttributes
		&&	OPTIONAL_ATTRIBUTE_KEYS.indexOf(key) >= 0
		) {
			value = XML_CUSTOM_NAMESPACE + ':' + value;
		}

		return value;
	}

	function setAttributesFromElement(oraNode, xmlNode, attributeNamesByKey) {

		function getPropertyKeyByAttributeName(name) {
			for (const key in attributeNamesByKey) {
			const	names = attributeNamesByKey[key];

				if (
					names.indexOf
					? names.indexOf(name) >= 0
					: names === name
				) {
					return key;
				}
			}

			if (
				XML_CUSTOM_NAMESPACE
			&&	hasPrefix(name, XML_CUSTOM_NAMESPACE + ':')
			) {
				return getPropertyKeyByAttributeName(name.slice(XML_CUSTOM_NAMESPACE.length + 1));
			}
		}

	const	attributes = xmlNode.attributes;

		for (
		var	length = attributes.length,
			index = 0;
			index < length;
			index++
		) {
		const	attribute = attributes.item(index);
		const	name = attribute.name || attribute.nodeName;
		const	value = attribute.textContent || attribute.nodeValue || attribute.value;
		const	key = getPropertyKeyByAttributeName(name);

			if (key) {
				oraNode[key] = value;
			} else {
			const	otherDict = oraNode.otherAttributes || (oraNode.otherAttributes = {});
				otherDict[name] = value;
			}
		}
	}

	function imageToCanvas(image, canvas, width, height, x,y) {
		canvas = canvas || document.createElement('canvas');
		canvas.width  = width  = width  || image.naturalWidth  || image.width;
		canvas.height = height = height || image.naturalHeight || image.height;

	const	ctx = canvas.getContext('2d');
		ctx.clearRect(0,0, width, height);
		ctx.drawImage(image, x||0, y||0, width, height);

		return canvas;
	};

	function imageContentFromCanvasToCallback(canvas, callback) {
		global.ora.enableImageAsBlob
		? canvas.toBlob(callback, 'image/png')
		: callback(canvas.toDataURL('image/png'));
	};

//* Extract an image from the ora into an Image object:
//* Note: dataURI has lower length limits than blobs.

	function extractImage(path, zipfs, onImageLoad, onDone, onError) {
	const	file = zipfs.find(path);

		if (file) {
		const	onExtract = function (src) {
			const	img = new global.Image();

				img.onerror = onError;
				img.onload = function (evt) {
					onImageLoad(evt);

					if (onDone) {
						onDone(img);
					}
				};

				img.src = src;
			};

		const	URL = global.URL || global.webkitURL;

			if (URL && global.ora.enableImageAsBlob) {
				file.getBlob('image/png', function (blob) {
					onExtract(URL.createObjectURL(blob));
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

	function getResizedCanvas(canvas, width, height, alwaysGetNewCopy) {
		if (
			!alwaysGetNewCopy
		&&	canvas.width <= width
		&&	canvas.height <= height
		) {
			return canvas;
		}

	const	ratio = canvas.width / canvas.height;

		if (ratio < 1) {
			width = height * ratio;
		} else {
			height = width / ratio;
		}

		return imageToCanvas(canvas, null, width, height);
	}

	function drawImageOrClearCanvas(canvas, image) {
	const	ctx = canvas.getContext('2d');

		if (image) {
		const	width  = image.naturalWidth  || image.width;
		const	height = image.naturalHeight || image.height;

			if (
				width  > 0
			&&	height > 0
			) {
				canvas.width  = width;
				canvas.height = height;
				ctx.clearRect(0,0, width, height);
				ctx.drawImage(image, 0,0);

				return;
			}
		}

		ctx.clearRect(0,0, canvas.width, canvas.height);
	};

	function composeBlending(oraFile, ctx, onDone) {
	const	imgData = ctx.getImageData(0,0, oraFile.width, oraFile.height);
	const	layersCount = oraFile.layers.length;
	var	canvas;

		for (
		var	layerIndex = 0;
			layerIndex < layerCount;
			layerIndex++
		) {
		const	layer = oraFile.layers[layerIndex];

			if (isLayerDrawable(layer)) {
			const	filter = global.blending[layer.composite] || global.blending.normal;
			const	srcCanvas = layer.toCanvas(canvas, oraFile.width, oraFile.height);
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
	var	worker, canvas;

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
						.toCanvas(canvas, oraFile.width, oraFile.height)
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

		function onTaskDone(evt) {
			if (evt.data.result) {
				ctx.putImageData(evt.data.result, 0,0);

				if (onDone) {
					onDone();
				}

				worker.terminate();

				return;
			}

		var	nextLayer = evt.data.layer + 1;

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

		worker = new global.Worker(global.ora.scriptsPath + 'blender.js');
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

	function addNestedNodeToArchive(node, path) {
		if (path.split) {
			path = path.split('/');
		}

		if (path.length > 0) {
			for (var partIndex in path) {
			var	subName = path[partIndex] || 'unnamed_folder';
				node = node.getChildByName(subName) || node.addDirectory(subName);
			}
		}

		return node;
	}

	function addFileToArchivePath(node, path, content) {
		path = path.split('/');

	const	fileName = path.pop() || ('unnamed_file_' + new Date());
		node = addNestedNodeToArchive(node, path);

		return addFileToArchiveNode(node, fileName, content);
	}

	function addFileToArchiveNode(node, fileName, content) {
		return node[
			isBlob(content)
			? 'addBlob'
			:
			isString(content) && content.slice(0,5) === 'data:'
			? 'addData64URI'
			: 'addText'
		](fileName, content);
	}

	function getNewZipFS() {
	const	ora = global.ora;
	const	zip = global.zip;

		if (
			zip !== null
		&&	typeof zip === 'object'
		) {
			if (ora.enableWorkers !== null) {
				zip.useWebWorkers = !!ora.enableWorkers;
			}

			if (
				zip.useWebWorkers
			&&	zip.workerScripts === null
			&&	zip.workerScriptsPath === null
			&&	ora.scriptsPath !== null
			) {
				zip.workerScriptsPath = ora.scriptsPath;
			}

			return new zip.fs.FS();
		}

		return null;
	}

//* Create and populate an OraFile object from a blob:
//* Note: onLoad = callback function with the loaded object as parameter.

	function loadFile(blob, onLoad, onError, onProgress) {
	const	oraFile = new OraFile();
		oraFile.load(blob, onLoad, onError, onProgress);
	}

	global.ora = {

//* Public static methods:

		Ora : OraFile,
		OraLayer : Layer,
		OraStack : Stack,
		load : loadFile,

//* Public static parameters:

		enableImageAsBlob : true,
		enableWorkers : true,
		preloadImages : true,
		prefixCustomAttributes : true,
		scriptsPath : '',
	};
})(this);
