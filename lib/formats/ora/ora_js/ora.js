
//* ORA file parser.
//* Modified version of https://github.com/zsgalusz/ora.js
//* Based on spec version 0.0.5 + custom extensions for testing.
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
const	COLOR_IMAGE_PREFIX = 'color';
const	EMPTY_IMAGE_PREFIX = 'empty';
const	MASK_IMAGE_PREFIX = 'mask';
const	MASK_ATTRIBUTE_PREFIX = 'mask_';
const	IMAGE_ATTRIBUTE_PREFIX = 'image_';
const	IMAGE_FILE_TYPE_PREFIX = 'image/';
const	NAMESPACE_ATTRIBUTE_PREFIX = 'xmlns:';
const	ROOT_STACK_DEFAULT_NAME = 'root';

const	LAYER_DEFAULT_PROPERTIES = {
		name : ''
	,	x : 0
	,	y : 0
	,	opacity : 1
	,	composite : 'svg:src-over'
	,	visibility : 'visible'
	,	src : getEmptyImageDataURL()
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

const	ROOT_IMAGE_DEFAULT_PROPERTIES = {
		width  : 0
	,	height : 0
	,	version : ''
	};

//* In each list here the first value is used for saving:

const	ROOT_IMAGE_ATTRIBUTE_NAMES_BY_KEY = {
		width  : ['w', /^((image|content)-)?width$/i]
	,	height : ['h', /^((image|content)-)?height$/i]
	,	version : ['version', 'v', /^(ora-)?version$/i]
	};

const	LAYER_ATTRIBUTE_NAMES_BY_KEY = {
		name : 'name'
	,	x : ['x', 'left']
	,	y : ['y', 'top']
	,	opacity : 'opacity'
	,	composite : 'composite-op'
	,	visibility : ['visibility', 'visible']
	,	src : 'src'

//* Custom-added properties, not in spec version 0.0.5:

	,	width  : ['w', /^((image|content)-)?width$/i]
	,	height : ['h', /^((image|content)-)?height$/i]
	,	image_file_type : ['type', /^(file|image|mime|content)-type$/i]

	,	clipping : ['clipping', 'clipped']
	,	composite_alpha : ['alpha-composite-op', 'composite-alpha']
	,	composite_color : ['color-composite-op', 'composite-color']

	,	mask_fill_outside : ['mask-fill-outside', 'mask-background-level']
	,	mask_src : ['mask-src', 'mask-image-src']
	,	mask_x : ['mask-x', /^mask-((image|content)-)?(x|left)$/i]
	,	mask_y : ['mask-y', /^mask-((image|content)-)?(y|top)$/i]
	,	mask_width  : ['mask-w', /^mask-((image|content)-)?width$/i]
	,	mask_height : ['mask-h', /^mask-((image|content)-)?height$/i]
	,	mask_image_file_type : ['mask-type', /^mask-(file|image|mime|content)-type$/i]
	};

const	STACK_ATTRIBUTE_NAMES_BY_KEY = {
		name : 'name'
	,	x : ['x', 'left']
	,	y : ['y', 'top']
	,	opacity : 'opacity'
	,	composite : 'composite-op'
	,	visibility : ['visibility', 'visible']
	,	isolation : ['isolation', 'isolate']

//* Custom-added properties, not in spec version 0.0.5:

	,	clipping : ['clipping', 'clipped']
	,	composite_alpha : ['alpha-composite-op', 'composite-alpha']
	,	composite_color : ['color-composite-op', 'composite-color']

	,	mask_fill_outside : ['mask-fill-outside', 'mask-background-level']
	,	mask_src : ['mask-src', 'mask-image-src']
	,	mask_x : ['mask-x', /^mask-((image|content)-)?(x|left)$/i]
	,	mask_y : ['mask-y', /^mask-((image|content)-)?(y|top)$/i]
	,	mask_width  : ['mask-w', /^mask-((image|content)-)?width$/i]
	,	mask_height : ['mask-h', /^mask-((image|content)-)?height$/i]
	,	mask_image_file_type : ['mask-type', /^mask-(file|image|mime|content)-type$/i]
	};

const	DONT_OMIT_ATTRIBUTE_KEYS = [
		'isolation'
	];

//* Custom-added properties, not in spec version 0.0.5:

const	OPTIONAL_ATTRIBUTE_KEYS = [
		'clipping'
	,	'composite_alpha'
	,	'composite_color'

	,	'mask_fill_outside'
	,	'mask_src'
	,	'mask_x'
	,	'mask_y'
	,	'mask_width'
	,	'mask_height'
	,	'mask_image_file_type'

	,	'width'
	,	'height'
	,	'image_file_type'
	];

const	OPTIONAL_IMAGE_ATTRIBUTE_KEYS = [
		'width'
	,	'height'
	];

const	IMAGE_HOLDER_ATTRIBUTE_KEYS = [
		'width'
	,	'height'
	,	'image_file_type'
	];

const	MASK_BLEND_MODES = [
		'svg:src-in'
	,	'svg:dst-in'
	,	'svg:src-out'
	,	'svg:dst-out'
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

const	IMAGE_FILE_TYPE_BY_EXT = {
		'jpg' : 'image/jpeg'
	,	'svg' : 'image/svg+xml'
	,	'tif' : 'image/tiff'
	};

const	NO_COMPRESSION_LEVEL = 0;
const	NORMAL_COMPRESSION_LEVEL = 6;

//* XSLT describes how we want to modify the XML - indent everything:
//* Source: https://stackoverflow.com/a/47317538

const	XML_INDENT_LEVEL_TEXT = '  ';
const	XML_PRETTY_PRINT_XSLT = [
		'<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">'
	,	'	<xsl:strip-space elements="*"/>'
//* Change to just text() to strip space in text nodes:
	,	'	<xsl:template match="para[content-style][not(text())]">'
	,	'		<xsl:value-of select="normalize-space(.)"/>'
	,	'	</xsl:template>'
	,	'	<xsl:template match="node()|@*">'
	,	'		<xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>'
	,	'	</xsl:template>'
	,	'	<xsl:output omit-xml-declaration="yes" indent="yes"/>'
	,	'</xsl:stylesheet>'
	].join('\n');

//* ---------------------------------------------------------------------------
//* OraFile object constructor:

	function OraFile(width, height) {
		this.width  = width  || 0;
		this.height = height || 0;
		this.layers = [];
	}

//* Stack object constructor:

	function Stack(name) {
	const	xmlNode = arguments[0];

		for (var key in STACK_DEFAULT_PROPERTIES) {
			this[key] = STACK_DEFAULT_PROPERTIES[key];
		}

		if (isStackElement(xmlNode)) {
			setAttributesFromElement(this, xmlNode, STACK_ATTRIBUTE_NAMES_BY_KEY);
		} else {
			this.name = isNullOrUndefined(name) ? 'New Folder' : String(name);
		}

		this.layers = [];
	}

//* Layer object constructor:

	function Layer(name, width, height) {
	const	xmlNode = arguments[0];

		for (var key in LAYER_DEFAULT_PROPERTIES) {
			this[key] = LAYER_DEFAULT_PROPERTIES[key];
		}

		if (isLayerElement(xmlNode)) {
			setAttributesFromElement(this, xmlNode, LAYER_ATTRIBUTE_NAMES_BY_KEY);
		} else {
			this.name = isNullOrUndefined(name) ? 'New Layer' : String(name);

			if (width)  this.width  = width;
			if (height) this.height = height;
		}
	}

//* Load the file contents from a blob:

	OraFile.prototype.load = function (blob, onLoadComplete, onError, onProgress) {

		function loadSrcImage(imageHolder) {

			function onImageLoad(evt) {
			const	imageElement = evt.target;

				if (
					imageElement
				&&	imageElement.width > 0
				&&	imageElement.height > 0
				) {
					setAttributesFromImage(imageHolder, imageElement);

					imageHolder.image = imageElement;
				} else {
					imageHolder.imageError = evt;

					console.error('Image is empty or does not exist:', [imageElement, 'Event:', evt]);
				}
			}

			function loadImage(onDone, onError) {
				extractImage(srcPath, zipFile, imageHolder.image_file_type, onImageLoad, onDone, onError);
			}

		const	srcPath = imageHolder.src;

			if (
				!srcPath
			||	srcPath.indexOf(EMPTY_IMAGE_PREFIX) >= 0
			||	!zipFile.find(srcPath)
			) {
				return;
			}

			addStepCount();

			if (global.ora.preloadImages) {
				loadImage(onStepDone, onStepDone);
			} else {
				imageHolder.loadImage = loadImage;

				onStepDone();
			}
		}

		function loadChildren(xmlParentNode, oraParentNode) {
			oraParentNode.layers = [];

		var	xmlNode = xmlParentNode.firstChild;

			while (xmlNode) {
			var	oraNode = null;

				if (isStackElement(xmlNode)) {
					oraNode = oraParentNode.addStack(xmlNode);

					loadChildren(xmlNode, oraNode);
				} else
				if (isLayerElement(xmlNode)) {
					oraNode = oraParentNode.addLayer(xmlNode);

					loadSrcImage(oraNode);
				}

				if (oraNode) {
					if (
						oraNode.mask_src
					||	oraNode.mask_fill_outside
					) {
					var	mask = {};

						for (var key in oraNode) if (hasPrefix(key, MASK_ATTRIBUTE_PREFIX)) {
							mask[key.slice(MASK_ATTRIBUTE_PREFIX.length)] = oraNode[key];
						}

						loadSrcImage(oraNode.mask = mask);
					}
				}

				xmlNode = xmlNode.nextSibling;
			}
		}

		function loadStack() {
		const	stackFile = zipFile.find('stack.xml');

			if (!stackFile) {
				oraFile.layers = [];

				onStepDone();

				return;
			}

//* Old Firefox (23.0.1 and earlier) doesn't like getText, so we roll our own:

			function onExtractBlob(blob) {

				function onExtract(evt) {
				const	text = evt.target.result;
				const	xml = getXMLDOMFromText(text);
				const	oraImage = xml.getElementsByTagName('image')[0];

					oraFile.layersCount = oraImage.getElementsByTagName('layer').length;
					oraFile.stacksCount = oraImage.getElementsByTagName('stack').length;
					oraFile.xmlDocument = xml;

					setAttributesFromElement(oraFile, oraImage, ROOT_IMAGE_ATTRIBUTE_NAMES_BY_KEY);

					loadChildren(oraImage, oraFile);

					onStepDone();
				}

			const	reader = new global.FileReader;
				reader.onerror = onError;
				reader.onload = onExtract;
				reader.readAsText(blob, 'UTF-8');
			}

			stackFile.getBlob('text/xml', onExtractBlob);
		}

		function loadOra() {
			loadSrcImage(oraFile.thumbnail = { 'src' : THUMBNAIL_IMAGE_FILE_PATH });
			loadSrcImage(oraFile.prerendered = { 'src' : MERGED_IMAGE_FILE_PATH });
			loadStack();
		}

//* Keeping track of finished loading tasks:

		function addStepCount() {
			++stepsTotal;

			if (onProgress) {
				onProgress(stepsDone, stepsTotal);
			}
		}

		function onStepDone() {
			++stepsDone;

			if (onProgress) {
				onProgress(stepsDone, stepsTotal);
			}

			if (stepsDone >= stepsTotal) {
				onLoadComplete(oraFile);
			}
		}

	var	stepsDone = 0;
	var	stepsTotal = 1;

//* Start loading:

	const	oraFile = this;
	const	zipFile = oraFile.zipFile = getNewZipFile();
		zipFile.importBlob(blob, loadOra, onError);
	};

//* Saving to a file:

	OraFile.prototype.saveOldFile = function (onSaveComplete, onError, onZipProgress) {
		this.zipFile.exportBlob(onSaveComplete, onZipProgress, onError);
	};

	OraFile.prototype.save = function (onSaveComplete, onError, onProgressByKey) {

		function setAttributesToElement(
			oraNode
		,	xmlNode
		,	attrNamesDict
		,	attrDefaultsDict
		,	optionalKeys
		,	optionalImageKeys
		,	image
		) {
			if (isNonNullObject(attrNamesDict))
			for (var key in attrNamesDict)
			if (
				global.ora.saveLayerImageFileType
			||	!hasPostfix(key, 'file_type')
			) {
			var	oraNodePropValue = oraNode[key];
			var	imagePropValue;

				if (
					!isNullOrUndefined(oraNodePropValue)
				&&	(
						DONT_OMIT_ATTRIBUTE_KEYS.indexOf(key) >= 0
						? true
						:
						optionalImageKeys
					&&	optionalImageKeys.indexOf(key) >= 0
						? (
							image
						&&	(imagePropValue = (
								image[key]
							||	image[
									key
									.replace(MASK_ATTRIBUTE_PREFIX, '')
									.replace(IMAGE_ATTRIBUTE_PREFIX, '')
								]
							))
						&&	imagePropValue !== oraNodePropValue
						) :
						optionalKeys
					&&	optionalKeys.indexOf(key) >= 0
						? FALSY_VALUES.indexOf(String(oraNodePropValue)) < 0
						:
						attrDefaultsDict
					&&	key in attrDefaultsDict
						? attrDefaultsDict[key] !== oraNodePropValue
						: true
					)
				) {
				var	attrName = getAttributeNameFromDict(attrNamesDict, key, optionalKeys);
				var	attrValue = getAttributeValueToSave(attrName, oraNodePropValue);

					if (!isNullOrUndefined(attrValue)) {
						xmlNode.setAttribute(attrName, attrValue);
					}
				}
			}

		const	otherDict = oraNode.otherAttributes;

			if (isNonNullObject(otherDict))
			for (var attrName in otherDict) {
			var	attrValue = otherDict[attrName];

				if (!isNullOrUndefined(attrValue)) {
					xmlNode.setAttribute(attrName, attrValue);

					if (loadedZipFile) {
					var	dataFile = loadedZipFile.find(attrValue);

						if (dataFile) {
							if (!includeOtherFilesByPath[attrValue]) {
								++includeOtherFilesTotal;
							}

							includeOtherFilesByPath[attrValue] = dataFile;
						}
					}
				}
			}
		}

		function addLayers(xmlParentNode, layers) {

			function addLayer(oraNode) {
			const	isLayer = oraNode instanceof Layer;
			const	isStack = oraNode instanceof Stack;

				if (!isLayer && !isStack) {
					return;
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

			const	xmlNode = xmlDocument.createElement(
					isLayer
					? 'layer'
					: 'stack'
				);

			const	image = oraNode.image;
			const	mask = oraNode.mask;

				if (image) {
					setAttributesFromImage(oraNode, image);
				}

				if (mask) {
					setAttributesFromImage(mask, mask.image);

					for (var key in mask) {
						oraNode[MASK_ATTRIBUTE_PREFIX + key] = mask[key];
					}
				}

				setAttributesToElement(
					oraNode
				,	xmlNode
				,	attrNamesDict
				,	attrDefaultsDict
				,	OPTIONAL_ATTRIBUTE_KEYS
				,	OPTIONAL_IMAGE_ATTRIBUTE_KEYS
				,	image
				);

				if (isLayer) {
					addLayerImage(
						xmlNode
					,	image || oraNode.toCanvas()
					,	attrNamesDict
					,	'src'
					,	OPTIONAL_ATTRIBUTE_KEYS
					,	oraNode.image_type || (
							MASK_BLEND_MODES.indexOf(oraNode.composite) >= 0
							? MASK_IMAGE_PREFIX
							: LAYER_IMAGE_PREFIX
						)
					);
				}

				if (mask) {
					addLayerImage(
						xmlNode
					,	mask.image || oraNode.maskToCanvas()
					,	attrNamesDict
					,	'mask_src'
					,	OPTIONAL_ATTRIBUTE_KEYS
					,	MASK_IMAGE_PREFIX
					);
				}

				if (isStack) {
					addLayers(xmlNode, oraNode.layers);
				}

				xmlParentNode.appendChild(xmlNode);
			}

			if (layers.map) {
				layers.map(addLayer);
			} else {
				addLayer(layers);
			}
		}

		function addLayerImage(xmlNode, content, attrNamesDict, attrNameKey, optionalKeys, srcNamePrefix) {
			addStepCount();

			if (content) {
				if (isCanvasElement(content)) {
				var	canvas = content;
					content = canvas.toDataURL('image/png');
				}

//* Do not reencode via canvas if not needed:

				if (isImageElement(content)) {
				var	image = content;
					content = image.src;
				}

				if (!srcNamePrefix || srcNamePrefix === LAYER_IMAGE_PREFIX) {
					if (image) {
						canvas = imageToCanvas(image);
					}

					if (canvas) {
					var	ctx = canvas.getContext('2d');
					var	imageData = ctx.getImageData(0,0, canvas.width, canvas.height);
					var	byteData = imageData.data;
					var	byteIndex = byteData.length;

						if (byteIndex > 0) {
						var	isColorFill = true;

							while (--byteIndex) if (
								byteData[byteIndex] !==
								byteData[byteIndex % 4]
							) {
								isColorFill = false;

								break;
							}

							if (isColorFill) {
								srcNamePrefix = COLOR_IMAGE_PREFIX;
							}
						}
					}
				}
			} else {

//* Some programs (e.g. MyPaint) reject ORA files where not every layer has an image, so we add an 1px transparent PNG:

				srcNamePrefix = EMPTY_IMAGE_PREFIX;
			}

		const	imageEntry = {
				'elements' : [
					{
						'image' : image || canvas || content
					,	'xmlNode' : xmlNode
					,	'attrName' : getAttributeNameFromDict(attrNamesDict, attrNameKey, optionalKeys)
					,	'lastModTime' : getModTime(image)
					}
				]
			};

		const	imageList = (
				(imagesByPrefix || (imagesByPrefix = {}))
				[srcNamePrefix] || (imagesByPrefix[srcNamePrefix] = [])
			);

			imageList.push(imageEntry);
			imageContentOnReady(content, onStepDone, imageEntry);
		}

		function imageContentOnReady(content, onDone, handler) {
			if (
				content
			&&	isString(content)
			&&	hasPrefix(content, 'blob:')
			) {
				getBlobFromURL(content, onDone, onError, handler);
			} else {
				onDone(content, handler);
			}
		}

		function addLayerImages() {

			if (onImageDedupProgress) {
				onImageDedupProgress(imagesDone, imagesTotal);
			}

//* Conflate identical image files:

			function collectElements(elements, imageEntry) {

				if (onImageDedupProgress) {
					onImageDedupProgress(++imagesDone, imagesTotal);
				}

				return elements.concat(
					imageEntry.elements
				);
			}

			function collectUniqueImages(uniqueImages, imageEntry) {
			var	isUnique = true;

				for (var imageIndex in uniqueImages) {
				var	uniqueEntry = uniqueImages[imageIndex];

					if (isIdenticalData(
						imageEntry.content
					,	uniqueEntry.content
					)) {
						uniqueEntry.elements = uniqueEntry.elements.concat(
							imageEntry.elements
						);

						isUnique = false;

						break;
					}
				}

				if (isUnique) {
					uniqueImages.push(imageEntry);
				}

				if (onImageDedupProgress) {
					onImageDedupProgress(++imagesDone, imagesTotal);
				}

				return uniqueImages;
			}

		const	imagesToSaveByPrefix = {};

			for (var srcNamePrefix in imagesByPrefix) {
			var	images = imagesByPrefix[srcNamePrefix];

				imagesToSaveByPrefix[srcNamePrefix] = (
					srcNamePrefix === EMPTY_IMAGE_PREFIX
					? [{
						'content' : getEmptyImageDataURL()
					,	'elements' : images.reduce(collectElements, [])
					}]
					: images.reduce(collectUniqueImages, [])
				);
			}

//* Sort filename prefixes lexically (empty, layer, mask):

		const	dataFolderNode = addNestedNodeToArchive(zipFile.root, LAYER_IMAGE_FOLDER);
		const	srcNamePrefixes = [];

			for (var srcNamePrefix in imagesToSaveByPrefix) {
				srcNamePrefixes.push(srcNamePrefix);
			}

//* Add image files and paths, batched by prefix and sorted by index:

			function addImageFilesByPrefix(srcNamePrefix) {

				function addImageFileWithPrefix(imageEntry, indexToSaveByPrefix) {

					function getMinModTime(tMin, dict) {
					var	tNext = getModTime(dict);

						if (tNext && (!tMin || (tMin > tNext))) {
							return tNext;
						}

						return tMin;
					}

					function updateImageElement(dict) {
						dict.xmlNode.setAttribute(dict.attrName, srcPath);
					}

				const	imageRelatedDicts = imageEntry.elements;
				var	img, width, height, fileType, fileExt;

					for (var dictIndex in imageRelatedDicts) {
						if (isImageElement(img = imageRelatedDicts[dictIndex].image)) {
							if (img.file_type) {
								fileType = img.file_type;
							} else
							if (hasPrefix(img.src, 'data:')) {
								fileType = (
									img.src
									.split(';', 1)[0]
									.split(':', 2)[1]
								);
							}

							if (fileType) {
								break;
							}
						}
					}

				const	isImageEmpty = (srcNamePrefix === EMPTY_IMAGE_PREFIX);

					if (fileType) {
						for (var key in IMAGE_FILE_TYPE_BY_EXT)
						if (fileType === IMAGE_FILE_TYPE_BY_EXT[key]) {
							fileExt = key;

							break;
						}

						if (!fileExt) {
							fileExt = (
								fileType
								.split('/').pop()
								.split('+').shift()
							);
						}
					}

				const	fileName = (
						(
							global.ora.saveLayerImageFileNamesWithType
							? (
								isImageEmpty
								? srcNamePrefix
								: srcNamePrefix + (indexToSaveByPrefix + 1)
							)
							: LAYER_IMAGE_PREFIX
						) + (
							global.ora.saveLayerImageFileNamesWithSize
						&&	!isImageEmpty
						&&	img
						&&	(width  = img.naturalWidth  || img.width)
						&&	(height = img.naturalHeight || img.height)
							? '_' + width + 'x' + height
							: ''
						) + '.' + (fileExt || 'png')
					);

				const	srcPath = (
						LAYER_IMAGE_FOLDER
					+	'/'
					+	fileName
					);

					addFileToArchiveNode(
						dataFolderNode
					,	fileName
					,	imageEntry.content
					).lastModTime = imageRelatedDicts.reduce(getMinModTime, null);

					imageRelatedDicts.map(updateImageElement);
				}

				imagesToSaveByPrefix[srcNamePrefix].map(addImageFileWithPrefix);
			}

			srcNamePrefixes.sort().map(addImageFilesByPrefix);

			setTimeout(doNextStep, 10);
		}

		function addExistingImage(image) {
			if (
				image
			&&	isImageElement(image = image.image || image)
			) {
				if (image.src) {
					imageContentOnReady(image.src, doNextStep);
				} else {
					imageToCanvas(image, canvas);
					addImageFileFromCanvas();
				}

				return true;
			}

			return false;
		}

		function addImageFileFromCanvas(newCanvas) {
			imageContentFromCanvasToCallback(newCanvas || canvas, doNextStep);
		}

		function addImageFileToArchive(path, content) {
			addFileToArchivePath(zipFile.root, path, content);

			if (onImageMergeProgress) {
				onImageMergeProgress(++renderDone, renderTotal);
			}

			setTimeout(doNextStep, 10);
		}

		function addOtherDataFilesToArchive() {

			function getOnExtractBlobCallback(dataFile, filePath) {
				return function (blob) {
				var	metaData, lastModDate, compression;

				var	addedFile = addFileToArchivePath(
						zipFile.root
					,	filePath
					,	blob
					);

					if (metaData = dataFile.data) {
						if (
							global.ora.zipInheritDataFileDate
						&&	!isNullOrUndefined(lastModDate = getModTime(metaData))
						) {
							addedFile.lastModDate = lastModDate;
						}

						if (
							global.ora.zipInheritDataFileCompression
						&&	!isNullOrUndefined(compression = metaData.compressionMethod)
						) {
							addedFile.compressionLevel = (
								compression
								? NORMAL_COMPRESSION_LEVEL
								: NO_COMPRESSION_LEVEL
							);
						}
					}

					++includeOtherFilesDone;

					if (onOtherDataProgress) {
						onOtherDataProgress(includeOtherFilesDone, includeOtherFilesTotal);
					}

					if (includeOtherFilesDone >= includeOtherFilesTotal) {
						setTimeout(doNextStep, 10);
					}
				}
			}

			for (var filePath in includeOtherFilesByPath) {
			var	dataFile = includeOtherFilesByPath[filePath];
				dataFile.getBlob('application/octet-stream', getOnExtractBlobCallback(dataFile, filePath));
			}
		}

		function doNextStep() {
			try {
			var	nextStep;

				while (stepsToDo.length > 0) if (nextStep = stepsToDo.shift()) {
					return nextStep.apply(oraFile, arguments);
				}
			} catch (error) {
				console.error(error);

				if (onError) {
					onError(error);
				}
			}
		}

//* Create or reuse merged image and thumbnail:

		function getOrCreateMergedImage() {
			if (onImageMergeProgress) {
				onImageMergeProgress(renderDone, renderTotal);
			}

			addExistingImage(oraFile.prerendered)
			|| oraFile.drawComposite(canvas, addImageFileFromCanvas);
		}

		function getOrCreateThumbnail() {
			addExistingImage(oraFile.thumbnail)
			|| addImageFileFromCanvas(getResizedCanvas(oraFile.prerendered || canvas, 256, 256));
		}

		function addMergedImageToArchive(content) {
			addImageFileToArchive(MERGED_IMAGE_FILE_PATH, content);
		}

		function addThumbnailToArchive(content) {
			addImageFileToArchive(THUMBNAIL_IMAGE_FILE_PATH, content);
		}

//* Create document text after all image file paths were added:

		function addStackFileToArchive() {
		const	xmlFileText = [
				'<?xml version="1.0" encoding="UTF-8"?>'
			,	'<!-- ' + XML_COMMENT_TEXT + ' (' + XML_CUSTOM_NAMESPACE_URL + ') -->'
			,	getPrettyPrintedXML(xmlDocument)
			].join('\n');

//* Always compress XML text file:

			zipFile.root.addText('stack.xml', xmlFileText).compressionLevel = NORMAL_COMPRESSION_LEVEL;

			setTimeout(doNextStep, 10);
		}

//* Create and return ZIP file content blob to onSaveComplete callback:

		function saveArchive() {
			if (typeof zipFile.setMimeType === 'function') {
				zipFile.setMimeType('image/openraster');
			}

			zipFile.exportBlob(onSaveComplete, onZipProgress, onError);
		}

		function onImagesComplete() {
			stepsToDo = [
				(imagesByPrefix ? addLayerImages : null),
				(includeOtherFilesTotal ? addOtherDataFilesToArchive : null),

				getOrCreateMergedImage,
				addMergedImageToArchive,

				getOrCreateThumbnail,
				addThumbnailToArchive,

				addStackFileToArchive,
				saveArchive
			];

			setTimeout(doNextStep, 10);
		}

//* Keeping track of finished loading tasks:

		function addStepCount() {
			++stepsTotal;
			++imagesTotal;

			if (onImageFoundProgress) {
				onImageFoundProgress(stepsDone, stepsTotal);
			}
		}

		function onStepDone(content, handler) {
			++stepsDone;

			if (onImageFoundProgress) {
				onImageFoundProgress(stepsDone, stepsTotal);
			}

			if (handler && content) {
				if (typeof handler === 'function') {
					handler(content);
				} else
				if (isNonNullObject(handler)) {
					handler.content = content;
				}
			}

			if (stepsDone >= stepsTotal) {
				onImagesComplete();
			}
		}

	var	stepsToDo;
	var	stepsDone = 0;
	var	stepsTotal = 1;

	var	imagesDone = 0;
	var	imagesTotal = 0;
	var	imagesByPrefix;

	var	includeOtherFilesTotal = 0;
	var	includeOtherFilesDone = 0;

	var	renderDone = 0;
	var	renderTotal = 2;

		if (!isNonNullObject(onProgressByKey)) {
			onProgressByKey = {};
		}

	var	onImageFoundProgress = onProgressByKey.imageFound || null;
	var	onImageDedupProgress = onProgressByKey.imageDedup || null;
	var	onImageMergeProgress = onProgressByKey.imageMerge || null;
	var	onOtherDataProgress = onProgressByKey.otherData || null;
	var	onZipProgress = onProgressByKey.zipExport || null;

	const	includeOtherFilesByPath = {};

//* Start saving:

	const	oraFile = this;
	const	rootLayers = oraFile.layers;
	const	loadedZipFile = oraFile.zipFile;

	const	zipFile = getNewZipFile();
		zipFile.lastModTime = getModTime(oraFile);

//* Never compress mimetype:

		zipFile.root.addText('mimetype', 'image/openraster').compressionLevel = NO_COMPRESSION_LEVEL;

//* Optionally compress PNGs:

		zipFile.compressionLevelDefault = (
			global.ora.zipCompressImageFiles
			? NORMAL_COMPRESSION_LEVEL
			: NO_COMPRESSION_LEVEL
		);

//* Create document tree:

	const	canvas = document.createElement('canvas');
	const	xmlDocument = document.implementation.createDocument(null, null, null);
	const	imageElement = xmlDocument.createElement('image');
		imageElement.setAttribute('version', ORA_VERSION);

		setAttributesToElement(
			oraFile
		,	imageElement
		,	ROOT_IMAGE_ATTRIBUTE_NAMES_BY_KEY
		,	ROOT_IMAGE_DEFAULT_PROPERTIES
		);

		if (XML_CUSTOM_NAMESPACE) {
			imageElement.setAttribute(NAMESPACE_ATTRIBUTE_PREFIX + XML_CUSTOM_NAMESPACE, XML_CUSTOM_NAMESPACE_URL);
		}

		xmlDocument.appendChild(imageElement);

//* Add layers to document tree:

		if (rootLayers.length > 0) {
		var	rootStack = rootLayers[0];

			if (
				rootLayers.length > 1
			||	rootStack.name !== ROOT_STACK_DEFAULT_NAME
			||	!isTrivialStack(rootStack)
			) {
				rootStack = new Stack(ROOT_STACK_DEFAULT_NAME);
				rootStack.layers = rootLayers;
			}

			if (rootStack.isolation === STACK_DEFAULT_PROPERTIES.isolation) {
				rootStack.isolation = null;
			}

			addLayers(imageElement, rootStack);
		}

//* Add image files and finish saving:

		onStepDone();
	};

//* Add a new layer to the image:
//* Note: index can optionally specify the position for the new layer.

	OraFile.prototype.addLayer =
	Stack.prototype.addLayer = function (name, index) {
		return this.addNode(new Layer(name), index);
	};

	OraFile.prototype.addStack =
	Stack.prototype.addStack = function (name, index) {
		return this.addNode(new Stack(name), index);
	};

	OraFile.prototype.addNode =
	Stack.prototype.addNode = function (oraNode, index) {
		oraNode.parent = this;

		if (!isArray(this.layers)) {
			this.layers = [];
		}

		if (
			typeof index !== 'undefined'
		&&	index >= 0
		&&	index < this.layers.length
		) {
			this.layers.splice(index, 0, oraNode);
		} else {
			this.layers.push(oraNode);
		}

		return oraNode;
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

	const	composingMethod = (
			!global.blending
			? composeWithSimpleBlending
			:
			global.Worker
		&&	global.ora.enableWorkers
			? composeWithCustomBlendingWorkers
			: composeWithCustomBlending
		);

		composingMethod(this, ctx, onDone);
	};

//* Draw layer onto a new canvas element:

	Layer.prototype.toCanvas = function (width, height) {
		return imageToCanvasFromLayer(this, width, height);
	};

	Layer.prototype.maskToCanvas =
	Stack.prototype.maskToCanvas = function (width, height) {
		return imageToCanvasFromLayer(this.mask, width, height);
	};

//* ---------------------------------------------------------------------------
//* Helper functions:

//* Create type-checking functions, e.g. "isString()" or "isImageElement()":
//* Source: https://stackoverflow.com/a/17772086

	[
		'Array',	//* <- matches anything with 'Array' at the end, e.g. 'Uint8Array'
		'Blob',
		'CanvasElement',
		'ImageElement',	//* <- matches anything with 'ImageElement' at the end, e.g. 'HTMLImageElement'
		'RegExp',
		'String',
	].map(
		function (typeName) {
		const	functionName = 'is' + typeName;

			if (typeof window[functionName] !== 'function') {
				window[functionName] = function (value) {
					return (toString.call(value).slice(-1 - typeName.length, -1) === typeName);
				};
			}
		}
	);

	function isSameDataURL(a, b) {
		return (
			isString(a)
		&&	isString(b)
		&&	a.length === b.length
		&&	a === b
		);
	}

//* Test for equality in ArrayBuffer or TypedArray:
//* Source: https://stackoverflow.com/a/52181275

	function isIdenticalBlob(a, b) {

		function isAlignedToBytes(a, bytesInElenment) {
			return (
				(a.byteOffset % bytesInElenment === 0)
			&&	(a.byteLength % bytesInElenment === 0)
			);
		}

		function isIdentical(a, b, bytesInElenment, typeConstructor) {

			if (bytesInElenment && typeConstructor) {
				return isIdentical(
					new typeConstructor(a.buffer, a.byteOffset, a.byteLength / bytesInElenment)
				,	new typeConstructor(b.buffer, b.byteOffset, b.byteLength / bytesInElenment)
				);
			}

		var	index = a.length;

			while (index--) if (a[index] !== b[index]) {
				return false;
			}

			return true;
		}

		if (
			isBlob(a)
		&&	isBlob(b)
		&&	a.size === b.size
		&&	a.type === b.type
		) {
			if (
				a.size > 0
			&&	(a = new global.Uint8Array(a.buffer))
			&&	(b = new global.Uint8Array(b.buffer))
			&&	a.byteLength === b.byteLength
			) {
				if (isAlignedToBytes(a, 4) && isAlignedToBytes(b, 4)) return isIdentical(a, b, 4, global.Uint32Array);
				if (isAlignedToBytes(a, 2) && isAlignedToBytes(b, 2)) return isIdentical(a, b, 2, global.Uint16Array);

				return isIdentical(a, b);
			}

			return true;
		}

		return false;
	}

	function isIdenticalData(a, b) {
		return (
			isSameDataURL(a, b)
		||	isIdenticalBlob(a, b)
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

	function isNonNullObject(value) { return (typeof value === 'object' && value !== null); }
	function isNullOrUndefined(value) { return (typeof value === 'undefined' || value === null); }
	function isLayerElement(xmlNode) { return (xmlNode && xmlNode.tagName && xmlNode.tagName.toLowerCase() === 'layer'); }
	function isStackElement(xmlNode) { return (xmlNode && xmlNode.tagName && xmlNode.tagName.toLowerCase() === 'stack'); }

	function isTrivialStack(oraNode) {
		for (var key in oraNode) {
			if (
				key === 'name'
			||	key === 'layers'
			||	key === 'isolation'
			||	typeof oraNode[key] === 'function'
			) {
				continue;
			}

			if (
				!(key in STACK_DEFAULT_PROPERTIES)
			||	(
					!isNullOrUndefined(oraNode[key])
				&&	oraNode[key] !== STACK_DEFAULT_PROPERTIES[key]
				)
			) {
				return false;
			}
		}

		return true;
	}

	function isAutoNonIsolatedStack(oraNode) {
		return (
			oraNode.isolation === 'auto'
		&&	(isNullOrUndefined(oraNode.opacity)   || oraNode.opacity   === STACK_DEFAULT_PROPERTIES.opacity)
		&&	(isNullOrUndefined(oraNode.composite) || oraNode.composite === STACK_DEFAULT_PROPERTIES.composite)
		);
	}

	function isLayerDrawable(oraNode) {
		return (
			oraNode && (
				oraNode instanceof Layer
				? oraNode.image
				:
				oraNode instanceof Stack
				? oraNode.layers && oraNode.layers.length > 0
				: false
			) && (
				isNullOrUndefined(oraNode.visibility)
			||	oraNode.visibility === 'visible'
			) && (
				isNullOrUndefined(oraNode.opacity)
			||	oraNode.opacity > 0
			)
		);
	}

	function getModTime(source, sourceBase) {
		return (
			source !== sourceBase
		&&	isNonNullObject(source)
			? Number(
				source.mod_time
			||	source.file_mod_time
			||	source.last_mod_time
			||	source.lastModDate
			||	source.lastModTime
			||	source.lastModified
			||	getModTime(source.data, sourceBase || source)
			)
			: null
		);
	}

	function getZippedFileSize(source, sourceBase) {
		return (
			source !== sourceBase
		&&	isNonNullObject(source)
			? Number(
				source.uncompressedSize
			||	source.size
			||	getZippedFileSize(source.data,   sourceBase || source)
			||	getZippedFileSize(source.reader, sourceBase || source)
			)
			: null
		);
	}

//* Use of apply() with 'new' operator:
//* Source: https://stackoverflow.com/a/8843181

	function getNewGlobal() {
	const	func = global[arguments[0]];

		if (!func) {
			return;
		}

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

//* Notes:
//*	Old Firefox (e.g. v56) throws an empty exception at importStylesheet.
//*	Without a try-catch it just silently stops.
//*	If with a try-catch (or a newer Firefox version) it continues and returns unprocessed original, use a fallback method.

		try {
			if (global.XSLTProcessor) {
			const	xsltDocument = getXMLDOMFromText(XML_PRETTY_PRINT_XSLT);
			const	xsltProcessor = getNewGlobal('XSLTProcessor');
				xsltProcessor.importStylesheet(xsltDocument);
			const	xmlDocument = (
					isString(source)
					? getXMLDOMFromText(source)
					: source
				);
			const	resultDocument = xsltProcessor.transformToDocument(xmlDocument);
			const	resultText = getTextFromXMLDOM(resultDocument);

			const	sourceText = (
					isString(source)
					? source
					: getTextFromXMLDOM(source)
				);

				return (
					resultText === sourceText
					? getPrettyPrintedXMLviaRegExp(sourceText)
					: resultText
				);
			}
		} catch (error) {
			if (error && error.message) {
				console.error(error);
			}
		}

		return getPrettyPrintedXMLviaRegExp(source);
	}

//* Fallback RegExp method without relying on XML API:

const	regFindWhiteSpaceBeforeTags = /\s+</g;
const	regFindWhiteSpaceAfterTags = />\s*/g;
const	regFindWhiteSpaceAtEOF = /\s+$/;
const	regFindTagsToIndent = /(<[^>]*>)($|[\r\n]+)/g;

	function getPrettyPrintedXMLviaRegExp(source) {

		function regReplaceTagToIndent(match, tagText) {
		const	openingChar = tagText.substr(1, 1);
		const	closingChar = tagText.substr(-2, 1);

			if (
				openingChar !== '?'
			&&	openingChar !== '!'
			&&	openingChar !== '/'
			&&	closingChar !== '/'
			) {
				return repeatText(
					XML_INDENT_LEVEL_TEXT
				,	indentLevel++
				) + match;
			}

			return (
				indentLevel > 0
				? repeatText(
					XML_INDENT_LEVEL_TEXT
				,	(
						openingChar === '/'
						? --indentLevel
						: indentLevel
						)
				) + match
				: match
			);
		}

	var	indentLevel = 0;

	const	sourceText = (
			isString(source)
			? source
			: getTextFromXMLDOM(source)
		);

	const	reindentedText = (
			sourceText
			.replace(regFindWhiteSpaceBeforeTags, '<')
			.replace(regFindWhiteSpaceAfterTags, '>\n')
			.replace(regFindWhiteSpaceAtEOF, '')
			.replace(regFindTagsToIndent, regReplaceTagToIndent)
		);

		return reindentedText || sourceText;
	}

	function repeatText(text, numberOfTimes) { return (new Array(numberOfTimes + 1)).join(text); }

	function getTextWithoutOwnNameSpace(text) {
		if (
			XML_CUSTOM_NAMESPACE
		&&	hasPrefix(text, XML_CUSTOM_NAMESPACE + ':')
		) {
			return text.slice(XML_CUSTOM_NAMESPACE.length + 1);
		}

		return text;
	}

	function canAddAttributePrefix(value) {
		return (
			XML_CUSTOM_NAMESPACE
		&&	global.ora.prefixCustomAttributes
		&&	isString(value)
		&&	value.length > 0
		&&	value.indexOf(':') < 0
		);
	}

	function getAttributeNameFromDict(dict, key, optionalKeys) {
	var	value = dict[key];

		if (isArray(value)) {
			value = value[0];
		}

		if (
			optionalKeys
		&&	optionalKeys.indexOf
		&&	canAddAttributePrefix(value)
		) {
		var	isKeyMatching = (optionalKeys.indexOf(key) >= 0);
		var	optionalPattern;

			if (!isKeyMatching) {
				for (var keyIndex in optionalKeys) if (
					isRegExp(optionalPattern = optionalKeys[keyIndex])
				&&	(isKeyMatching = optionalPattern.test(key))
				) {
					break;
				}
			}

			if (isKeyMatching) {
				value = XML_CUSTOM_NAMESPACE + ':' + value;
			}
		}

		return value;
	}

	function getAttributeValueToSave(name, value) {
		if (
			canAddAttributePrefix(value)
		&&	(
				(name === 'composite-op')
			||	(name === 'isolation' && value !== 'isolate' && value !== 'auto')
			)
		) {
			value = XML_CUSTOM_NAMESPACE + ':' + value;
		}

		return value;
	}

	function setAttributesFromImage(imageHolder, imageElement) {
		if (
			isNonNullObject(imageHolder)
		&&	isImageElement(imageElement)
		)
		for (var keyIndex in IMAGE_HOLDER_ATTRIBUTE_KEYS) {
		var	key = IMAGE_HOLDER_ATTRIBUTE_KEYS[keyIndex];
		var	imagePropValue;

			if (
				!imageHolder[key]
			&&	(imagePropValue = (
					imageElement[key]
				||	imageElement[
						key
						.replace(MASK_ATTRIBUTE_PREFIX, '')
						.replace(IMAGE_ATTRIBUTE_PREFIX, '')
					]
				))
			) {
				imageHolder[key] = imagePropValue;
			}
		}
	}

	function setAttributesFromElement(oraNode, xmlNode, attributeNamesByKey) {

		function getPropertyKeyByAttributeName(name) {
			for (var key in attributeNamesByKey) {
			var	names = attributeNamesByKey[key];

				if (
					names.indexOf
					? names.indexOf(name) >= 0
					: names === name
				) {
					return key;
				}
			}
		}

		if (
			isNonNullObject(oraNode)
		&&	isNonNullObject(xmlNode)
		) {
		const	attributes = xmlNode.attributes;

			for (
			var	length = attributes.length,
				index = 0;
				index < length;
				index++
			) {
			var	attribute = attributes.item(index);
			var	name = getTextWithoutOwnNameSpace(attribute.name || attribute.nodeName);
			var	value = getTextWithoutOwnNameSpace(attribute.textContent || attribute.nodeValue || attribute.value);
			var	key = getPropertyKeyByAttributeName(name);

				if (key) {
					oraNode[key] = value;
				} else {
				var	otherDict = oraNode.otherAttributes || (oraNode.otherAttributes = {});
					otherDict[name] = value;
				}
			}
		}
	}

	function imageToCanvasFromLayer(imageHolder, width, height) {
		if (!isNonNullObject(imageHolder)) {
			return;
		}

	const	image = imageHolder.image;

		if (!isImageElement(image)) {
			return;
		}

		if (
			isNullOrUndefined(width)
		&&	isNullOrUndefined(height)
		) {
			return imageToCanvas(image);
		}

		return imageToCanvas(
			image
		,	null
		,	width
		,	height
		,	imageHolder.x
		,	imageHolder.y
		);
	}

	function imageToCanvas(image, canvas, canvasWidth, canvasHeight, x,y, drawWidth, drawHeight) {

		if (image) {
			drawWidth  = drawWidth  || image.naturalWidth  || image.width;
			drawHeight = drawHeight || image.naturalHeight || image.height;
		}

		canvas = canvas || document.createElement('canvas');
		canvas.width  = canvasWidth  = canvasWidth  || drawWidth  || 1;
		canvas.height = canvasHeight = canvasHeight || drawHeight || 1;

	const	ctx = canvas.getContext('2d');
		ctx.clearRect(0,0, canvasWidth, canvasHeight);

		if (image) {
			ctx.drawImage(
				image
			,	x || 0
			,	y || 0
			,	drawWidth
			,	drawHeight
			);
		}

		return canvas;
	}

	function imageContentFromCanvasToCallback(canvas, callback) {
		global.ora.enableImageAsBlob
		? canvas.toBlob(callback, 'image/png')
		: callback(canvas.toDataURL('image/png'));
	}

//* Extract an image from the ora into an Image object:
//* Note: dataURI has lower length limits than blobs.

	function extractImage(path, zipFile, fileType, onImageLoad, onDone, onError) {

		function onExtractBlob(blob) {
			onExtract(URL.createObjectURL(blob));
		}

		function onExtract(src) {

			function onLoad(evt) {
				if (onImageLoad) onImageLoad(evt);
				if (onDone) onDone(image);
			}

		const	image = new global.Image();

			image.file_type = fileType;
			image.file_size = getZippedFileSize(file);
			image.file_mod_time = getModTime(file);

			image.onerror = onError;
			image.onload = onLoad;

			image.src = src;
		}

	const	file = zipFile.find(path);

		if (file) {

//* Use filename extension to determine omitted image type for non-PNG layer images:
//* https://invent.kde.org/artoriatwoexpfive/openraster-org/-/blob/artoriatwoexpfive-master-patch-11215/proposals/more-image-formats.rst
//* Correlation with filename extensions: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types

			if (
				!isString(fileType)
			||	!fileType.length
			) {
			var	fileExt = path.split('.').pop() || 'png';
			var	fileType = (
					IMAGE_FILE_TYPE_BY_EXT[fileExt]
				||	(IMAGE_FILE_TYPE_PREFIX + fileExt)
				);
			}

		const	URL = global.URL || global.webkitURL;

			if (URL && global.ora.enableImageAsBlob) {
				file.getBlob(fileType, onExtractBlob);
			} else {
				file.getData64URI(fileType, onExtract);
			}
		} else
		if (onError) {
			onError();
		}
	}

//* 1x1 transparent PNG file:

//* 68 bytes, source: https://stackoverflow.com/a/36610159
// var	emptyImageDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';

//* 68 bytes, source: https://png-pixel.com/
// var	emptyImageDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

//* 67 bytes, source: canvas.toDataURL + Leanify
var	emptyImageDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mMAAQAABQABoIJXOQAAAABJRU5ErkJggg==';

	function getEmptyImageDataURL() {
		return emptyImageDataURL || (emptyImageDataURL = imageToCanvas().toDataURL('image/png'));
	}

	function getBlobFromURL(url, onDone, onError, handler) {

		function onReadResponse(evt) {

			function onReadDone(evt) {
				blob.buffer = evt.target.result;
				onDone(blob, handler);
			}

		const	blob = evt.target.response;
		const	reader = new global.FileReader;
			reader.onerror = onError;
			reader.onload = onReadDone;
			reader.readAsArrayBuffer(blob);
		}

	const	request = new global.XMLHttpRequest();
		request.responseType = 'blob';
		request.onerror = onError;
		request.onload = onReadResponse;
		request.open('GET', url, true);
		request.send();
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

		return imageToCanvas(canvas, null, null, null, null, null, width, height);
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
	}

	function setCanvasBlendMode(ctx, oraBlendMode, opacity) {

		ctx.globalAlpha = (opacity > 0 ? opacity : 1);
		ctx.globalCompositeOperation = 'source-over';

		if (oraBlendMode) {
		const	jsBlendMode = (
				String(oraBlendMode)
				.replace(/^.*:/g, '')
				.replace(/[\s\/_-]+/g, '-')
				.replace('src', 'source')
				.replace('dst', 'destination')
				.replace('add', 'lighter')
				.replace('plus', 'lighter')
			);

			ctx.globalCompositeOperation = jsBlendMode;
		}
	}

	function composeWithSimpleBlending(oraFile, ctx, onDone) {

		function drawMergedLayers(parentNode, ctx) {
			if (
				(layers = parentNode.layers)
			&&	(layerIndex = layers.length) > 0
			) {
			var	canvas, oraNode, layers, layerIndex;

				if (ctx) {
					canvas = ctx.canvas;
				} else {
					canvas = document.createElement('canvas');
					canvas.width  = oraFile.width;
					canvas.height = oraFile.height;
					ctx = canvas.getContext('2d');
				}

				while (layerIndex--) if (isLayerDrawable(oraNode = layers[layerIndex])) {

					setCanvasBlendMode(ctx, oraNode.composite, oraNode.opacity);

					if (oraNode instanceof Stack) {
						if (isAutoNonIsolatedStack(oraNode)) {
							drawMergedLayers(oraNode, ctx);
						} else {
							ctx.drawImage(drawMergedLayers(oraNode), 0,0);
						}
					} else
					if (oraNode instanceof Layer) {
						ctx.drawImage(oraNode.image, oraNode.x, oraNode.y);
					}

					setCanvasBlendMode(ctx);
				}

				return canvas;
			}
		}

		drawMergedLayers(oraFile, ctx);

		if (onDone) {
			onDone();
		}
	}

	function composeWithCustomBlending(oraFile, ctx, onDone) {

		function drawMergedLayers(parentNode, imageData) {
			if (
				(layers = parentNode.layers)
			&&	(layerIndex = layers.length) > 0
			) {
			var	layerImageData, oraNode, layers, layerIndex;

				if (!imageData) {
					imageData = new ImageData(oraFile.width, oraFile.height);
				}

				while (layerIndex--) if (isLayerDrawable(oraNode = layers[layerIndex])) {

//* TODO: masks, passthrough and all actual blending modes

					if (oraNode instanceof Stack) {
						if (isAutoNonIsolatedStack(oraNode)) {
							drawMergedLayers(oraNode, imageData);

							continue;
						}

						layerImageData = drawMergedLayers(oraNode);
					} else
					if (oraNode instanceof Layer) {
						layerImageData = (
							oraNode
							.toCanvas(oraFile.width, oraFile.height)
							.getContext('2d')
							.getImageData(0,0, oraFile.width, oraFile.height)
						);
					} else {
						continue;
					}

					global.blending.blend(
						layerImageData.data
					,	imageData.data
					,	oraNode.opacity
					,	global.blending[oraNode.composite] || global.blending.normal
					);
				}

				return imageData;
			}
		}

	const	imageData = drawMergedLayers(oraFile);

		if (imageData) {
		const	canvas = ctx.canvas;
			canvas.width  = oraFile.width;
			canvas.height = oraFile.height;

			ctx.putImageData(imageData, 0,0);
		}

		if (onDone) {
			onDone();
		}
	}

//* TODO: nested stack rendering	- v -

	function composeWithCustomBlendingWorkers(oraFile, ctx, onDone) {

	const	layerCache = [];
	var	layerIndex = oraFile.layers.length;

		while (layerIndex--) if (isLayerDrawable(oraNode = layers[layerIndex])) {

			if (startLayer < 0) {
				startLayer = layerIndex;
			}

			layerCache[layerIndex] = {
				opacity   : layer.opacity
			,	composite : layer.composite
			,	ctx : (
					layer
					.toCanvas(oraFile.width, oraFile.height)
					.getContext('2d')
				)
			};
		}

	var	startLayer = -1;
	var	worker, canvas, oraNode;

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
				'layer'   : nextLayer
			,	'src'     : layer.ctx.getImageData(0,0, oraFile.width, oraFile.height)
			,	'opacity' : layer.opacity
			,	'filter'  : layer.composite
			};

			worker.postMessage(nextBatch);
		}

		worker = new global.Worker(global.ora.scriptsPath + 'ora-blending-worker.js');
		worker.onmessage = onTaskDone;

	const	layer = layerCache[startLayer];
	const	initData = {
			'layer'   : startLayer
		,	'src'     : layer.ctx.getImageData(0,0, oraFile.width, oraFile.height)
		,	'opacity' : layer.opacity
		,	'filter'  : layer.composite
		,	'dst'     : ctx.getImageData(0,0, oraFile.width, oraFile.height)
		};

		worker.postMessage(initData);
	}

	composeWithCustomBlendingWorkers = composeWithCustomBlending;

//* TODO: nested stack rendering	- ^ -

	function addNestedNodeToArchive(zipNode, path) {
		if (path.split) {
			path = path.split('/');
		}

		if (path.length > 0) {
			for (var partIndex in path) {
			var	subName = path[partIndex] || 'unnamed_folder';
				zipNode = zipNode.getChildByName(subName) || zipNode.addDirectory(subName);
			}
		}

		return zipNode;
	}

	function addFileToArchivePath(zipNode, path, content) {
		path = path.split('/');

	const	fileName = path.pop() || ('unnamed_file_' + new global.Date());
		zipNode = addNestedNodeToArchive(zipNode, path);

		return addFileToArchiveNode(zipNode, fileName, content);
	}

	function addFileToArchiveNode(zipNode, fileName, content) {
		return zipNode[
			isBlob(content)
			? 'addBlob'
			:
			isString(content) && hasPrefix(content, 'data:')
			? 'addData64URI'
			: 'addText'
		](fileName, content);
	}

	function getNewZipFile() {
	const	ora = global.ora;
	const	zip = global.zip;

		if (isNonNullObject(zip)) {
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

//* ---------------------------------------------------------------------------
//* Public API object:

	global.ora = {

//* Public static methods:

		Ora : OraFile,
		OraLayer : Layer,
		OraStack : Stack,
		load : loadFile,

//* Public static parameters:

		enableImageAsBlob : true,
		enableWorkers : true,
		keepLayersOrderTopToBottom : true,
		prefixCustomAttributes : true,
		preloadImages : true,
		saveLayerImageFileNamesWithSize : true,
		saveLayerImageFileNamesWithType : true,
		saveLayerImageFileType : false,
		zipCompressImageFiles : true,
		zipInheritDataFileCompression : false,
		zipInheritDataFileDate : true,

		scriptsPath : ''
	};
})(this);
