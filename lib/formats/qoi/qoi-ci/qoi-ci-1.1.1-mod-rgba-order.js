// Generated automatically with "cito" + swapped RGB channels order to match JS ImageData.

"use strict";

/**
 * Encoder of the "Quite OK Image" (QOI) format.
 * Losslessly compresses an image to a byte array.
 */
function QOIEncoder()
{
}

QOIEncoder.HEADER_SIZE = 14;

QOIEncoder.PADDING_SIZE = 8;

/**
 * Determines if an image of given size can be encoded.
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param alpha Whether the image has the alpha channel (transparency).
 */
QOIEncoder.canEncode = function(width, height, alpha)
{
	return width > 0 && height > 0 && height <= ((2147483625 / width | 0) / (alpha ? 5 : 4) | 0);
}

/**
 * Encodes the given image.
 * Returns <code>true</code> if encoded successfully.
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param pixels Pixels of the image, top-down, left-to-right.
 * @param alpha <code>false</code> specifies that all pixels are opaque. High bytes of <code>pixels</code> elements are ignored then.
 * @param linearColorspace Specifies the color space.
 */
QOIEncoder.prototype.encode = function(width, height, pixels, alpha, linearColorspace)
{
	if (pixels == null || !QOIEncoder.canEncode(width, height, alpha))
		return false;
	let pixelsSize = width * height;
	let encoded = new Uint8Array(14 + pixelsSize * (alpha ? 5 : 4) + 8);
	encoded[0] = 113;
	encoded[1] = 111;
	encoded[2] = 105;
	encoded[3] = 102;
	encoded[4] = width >> 24;
	encoded[5] = width >> 16 & 255;
	encoded[6] = width >>  8 & 255;
	encoded[7] = width       & 255;
	encoded[8] = height >> 24;
	encoded[9] = height >> 16 & 255;
	encoded[10] = height >> 8 & 255;
	encoded[11] = height      & 255;
	encoded[12] = alpha ? 4 : 3;
	encoded[13] = linearColorspace ? 1 : 0;
	const index = new Int32Array(64);
	let encodedOffset = 14;
	let lastPixel = -16777216;
	let run = 0;

	for (let pixelsOffset = 0; pixelsOffset < pixelsSize;) {
		let pixel = pixels[pixelsOffset++];
		if (!alpha)
			pixel |= -16777216;
		if (pixel == lastPixel) {
			if (++run == 62 || pixelsOffset >= pixelsSize) {
				encoded[encodedOffset++] = 191 + run;
				run = 0;
			}
		}
		else {
			if (run > 0) {
				encoded[encodedOffset++] = 191 + run;
				run = 0;
			}
/* original:
			let indexOffset = (
				(pixel >> 16) * 3
			+	(pixel >>  8) * 5
			+	(pixel &  63) * 7
			+	(pixel >> 24) * 11
			) & 63;
*/
			let r =  pixel        & 255;
			let g = (pixel >>  8) & 255;
			let b = (pixel >> 16) & 255;
			let a = (pixel >> 24) & 255;

			let indexOffset = (
				r * 3
			+	g * 5
			+	b * 7
			+	a * 11
			) & 63;

			if (pixel == index[indexOffset])
				encoded[encodedOffset++] = indexOffset;
			else {
				index[indexOffset] = pixel;
/* original:
				let r = pixel >> 16 & 255;
				let g = pixel >>  8 & 255;
				let b = pixel       & 255;
				let a = pixel >> 24 & 255;
*/
				if ((pixel ^ lastPixel) >> 24 != 0) {
					encoded[encodedOffset] = 255;
					encoded[encodedOffset + 1] = r;
					encoded[encodedOffset + 2] = g;
					encoded[encodedOffset + 3] = b;
					encoded[encodedOffset + 4] = a;
					encodedOffset += 5;
				}
				else {
/* original:
					let dr = r - (lastPixel >> 16 & 255);
					let dg = g - (lastPixel >>  8 & 255);
					let db = b - (lastPixel       & 255);
*/
					let dr = r - (lastPixel       & 255);
					let dg = g - (lastPixel >>  8 & 255);
					let db = b - (lastPixel >> 16 & 255);

					if (dr >= -2 && dr <= 1 && dg >= -2 && dg <= 1 && db >= -2 && db <= 1)
						encoded[encodedOffset++] = 106 + (dr << 4) + (dg << 2) + db;
					else {
						dr -= dg;
						db -= dg;

						if (dr >= -8 && dr <= 7 && dg >= -32 && dg <= 31 && db >= -8 && db <= 7) {
							encoded[encodedOffset] = 160 + dg;
							encoded[encodedOffset + 1] = 136 + (dr << 4) + db;
							encodedOffset += 2;
						}
						else {
							encoded[encodedOffset] = 254;
							encoded[encodedOffset + 1] = r;
							encoded[encodedOffset + 2] = g;
							encoded[encodedOffset + 3] = b;
							encodedOffset += 4;
						}
					}
				}
			}
			lastPixel = pixel;
		}
	}
	encoded.fill(0, encodedOffset, encodedOffset + 7);
	encoded[encodedOffset + 8 - 1] = 1;
	this.encoded = encoded;
	this.encodedSize = encodedOffset + 8;
	return true;
}

/**
 * Returns the encoded file contents.
 * This method can only be called after <code>Encode</code> returned <code>true</code>.
 * The allocated array is usually larger than the encoded data.
 * Call <code>GetEncodedSize</code> to retrieve the number of leading bytes that are significant.
 */
QOIEncoder.prototype.getEncoded = function()
{
	return this.encoded;
}

/**
 * Returns the encoded file length.
 */
QOIEncoder.prototype.getEncodedSize = function()
{
	return this.encodedSize;
}

/**
 * Decoder of the "Quite OK Image" (QOI) format.
 */
function QOIDecoder()
{
}

/**
 * Decodes the given QOI file contents.
 * Returns <code>true</code> if decoded successfully.
 * @param encoded QOI file contents. Only the first <code>encodedSize</code> bytes are accessed.
 * @param encodedSize QOI file length.
 */
QOIDecoder.prototype.decode = function(encoded, encodedSize)
{
	if (encoded == null || encodedSize < 23 || encoded[0] != 113 || encoded[1] != 111 || encoded[2] != 105 || encoded[3] != 102)
		return false;
	let width  = encoded[4] << 24 | encoded[5] << 16 | encoded[6]  << 8 | encoded[7];
	let height = encoded[8] << 24 | encoded[9] << 16 | encoded[10] << 8 | encoded[11];
	if (width <= 0 || height <= 0 || height > (2147483647 / width | 0))
		return false;
	switch (encoded[12]) {
	case 3:
		this.alpha = false;
		break;
	case 4:
		this.alpha = true;
		break;
	default:
		return false;
	}
	switch (encoded[13]) {
	case 0:
		this.linearColorspace = false;
		break;
	case 1:
		this.linearColorspace = true;
		break;
	default:
		return false;
	}
	let pixelsSize = width * height;
	let pixels = new Int32Array(pixelsSize);
	encodedSize -= 8;
	let encodedOffset = 14;
	const index = new Int32Array(64);
	let pixel = -16777216;
	for (let pixelsOffset = 0; pixelsOffset < pixelsSize;) {
		if (encodedOffset >= encodedSize)
			return false;
		let e = encoded[encodedOffset++];
		switch (e >> 6) {
		case 0:
			pixels[pixelsOffset++] = pixel = index[e];
			continue;
		case 1:
/* original:
			pixel = (
				(pixel & -16777216)
			|	((pixel + (((e >> 4) - 4 - 2) << 16)) & 16711680)
			|	((pixel + (((e >> 2 & 3) - 2) <<  8)) & 65280)
			|	((pixel +   (e      & 3) - 2)         & 255)
			);
*/
			pixel = (
				(pixel & -16777216)
			|	((pixel + (((e >> 4) - 4 - 2)      )) & 255)
			|	((pixel + (((e >> 2 & 3) - 2) <<  8)) & 65280)
			|	((pixel + (((e      & 3) - 2) << 16)) & 16711680)
			);

			break;
		case 2:
			e -= 160;
			let rb = encoded[encodedOffset++];
/* original:
			pixel = (
				(pixel & -16777216)
			|	((pixel + ((e + (rb >> 4) - 8) << 16)) & 16711680)
			|	((pixel +  (e                  <<  8)) & 65280)
			|	((pixel +   e + (rb & 15) - 8)         & 255)
			);
*/
			pixel = (
				(pixel & -16777216)
			|	((pixel + ((e + (rb >> 4) - 8)      )) & 255)
			|	((pixel + ((e                ) <<  8)) & 65280)
			|	((pixel + ((e + (rb & 15) - 8) << 16)) & 16711680)
			);

			break;
		default:
			if (e < 254) {
				e -= 191;
				if (pixelsOffset + e > pixelsSize)
					return false;
				pixels.fill(pixel, pixelsOffset, pixelsOffset + e);
				pixelsOffset += e;
				continue;
			}
			if (e == 254) {
/* original:
				pixel = (
					(pixel & -16777216)
				|	encoded[encodedOffset    ] << 16
				|	encoded[encodedOffset + 1] << 8
				|	encoded[encodedOffset + 2]
				);
*/
				pixel = (
					(pixel & -16777216)
				|	(encoded[encodedOffset + 2] << 16)
				|	(encoded[encodedOffset + 1] <<  8)
				|	 encoded[encodedOffset]
				);

				encodedOffset += 3;
			}
			else {
/* original:
				pixel = (
					encoded[encodedOffset + 3] << 24
				|	encoded[encodedOffset    ] << 16
				|	encoded[encodedOffset + 1] << 8
				|	encoded[encodedOffset + 2]
				);
*/
				pixel = (
					(encoded[encodedOffset + 3] << 24)
				|	(encoded[encodedOffset + 2] << 16)
				|	(encoded[encodedOffset + 1] <<  8)
				|	 encoded[encodedOffset]
				);

				encodedOffset += 4;
			}
			break;
		}
/* original:
		pixels[pixelsOffset++] = index[
			((pixel >> 16) * 3)
		+	((pixel >>  8) * 5
		+	((pixel  & 63) * 7)
		+	((pixel >> 24) * 11) & 63
		] = pixel;
*/
		pixels[pixelsOffset++] = index[
			((pixel        & 63) * 3
		+	((pixel >>  8) & 63) * 5
		+	((pixel >> 16) & 63) * 7
		+	((pixel >> 24) & 63) * 11) & 63
		] = pixel;
	}
	if (encodedOffset != encodedSize)
		return false;
	this.width = width;
	this.height = height;
	this.pixels = pixels;
	return true;
}

/**
 * Returns the width of the decoded image in pixels.
 */
QOIDecoder.prototype.getWidth = function()
{
	return this.width;
}

/**
 * Returns the height of the decoded image in pixels.
 */
QOIDecoder.prototype.getHeight = function()
{
	return this.height;
}

/**
 * Returns the pixels of the decoded image, top-down, left-to-right.
 * Each pixel is a 32-bit integer 0xAARRGGBB.
 */
QOIDecoder.prototype.getPixels = function()
{
	return this.pixels;
}

/**
 * Returns the information about the alpha channel from the file header.
 */
QOIDecoder.prototype.hasAlpha = function()
{
	return this.alpha;
}

/**
 * Returns the color space information from the file header.
 * <code>false</code> = sRGB with linear alpha channel.<code>true</code> = all channels linear.
 */
QOIDecoder.prototype.isLinearColorspace = function()
{
	return this.linearColorspace;
}
