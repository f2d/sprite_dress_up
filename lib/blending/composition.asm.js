
function AsmCompositionModule(std, env, heap) {
	'use asm';

//* Declare in-module shared variables: ---------------------------------------

	var floor  = std.Math.floor;
	// var fround = std.Math.fround;
	// var imul   = std.Math.imul;	//* <- int-only multiply

	var ZERO_VALUE = 0;
	var MAX_VALUE = 255;

	var ZERO_ALPHA = 0.0;
	var MAX_ALPHA = 1.0;

	var valueResult = 0;
	var valueAbove  = 0;
	var valueBelow  = 0;

	var alphaAbove = 0.0;
	var alphaBelow = 0.0;
	var alphaAComp = 0.0;
	var alphaBComp = 0.0;
	// var alphaSum   = 0.0;
	// var alphaANorm = 0.0;
	// var alphaBNorm = 0.0;
	// var alphaMixed = 0.0;
	// var alphaMComp = 0.0;

	var i = 0;
	var j = 0;
	var k = 0;

	var r = 0;
	var g = 0;
	var b = 0;
	var a = 0;

	var uint8 = new std.Uint8Array(heap);		//* <- to read RGBA pixel data
	var uint32 = new std.Uint32Array(heap);	//* <- to write result back

//* Declare in-module functions: ----------------------------------------------

	function reset_vars(data_length) {
		data_length = data_length|0;

		i = data_length|0;
		j = (data_length << 1)|0;
		k = 0;

		valueResult = ZERO_VALUE;
		valueAbove  = ZERO_VALUE;
		valueBelow  = ZERO_VALUE;

		alphaAbove = ZERO_ALPHA;
		alphaBelow = ZERO_ALPHA;
		alphaAComp = ZERO_ALPHA;
		alphaBComp = ZERO_ALPHA;
		// alphaSum   = ZERO_ALPHA;
		// alphaANorm = ZERO_ALPHA;
		// alphaBNorm = ZERO_ALPHA;
		// alphaMixed = ZERO_ALPHA;
		// alphaMComp = ZERO_ALPHA;
	}

	function clamp_result() {
		if ((valueResult|0) < (ZERO_VALUE|0)) valueResult = ZERO_VALUE|0; else
		if ((valueResult|0) >  (MAX_VALUE|0)) valueResult =  MAX_VALUE|0;

		// if ((valueResult|0) != (valueBelow|0)) uint8[i] = valueResult|0;
		// uint8[i] = valueResult|0;
	}

	function blend_alpha(i,j) {
		i = i|0;
		j = j|0;

		var a = 0.0;
		var b = 0.0;
		var c = 0.0;

		c = +(MAX_VALUE|0);

		valueBelow = uint8[i]|0;
		valueAbove = uint8[j]|0;

		if ((valueAbove|0) == (ZERO_VALUE|0)) alphaAbove = ZERO_ALPHA; else
		if ((valueAbove|0) ==  (MAX_VALUE|0)) alphaAbove =  MAX_ALPHA;
		else {
			a = +(valueAbove|0);
			alphaAbove = +(a / c);
		}

		if ((valueBelow|0) == (ZERO_VALUE|0)) alphaBelow = ZERO_ALPHA; else
		if ((valueBelow|0) ==  (MAX_VALUE|0)) alphaBelow =  MAX_ALPHA;
		else {
			b = +(valueBelow|0);
			alphaBelow = +(b / c);
		}

		alphaAComp = +(MAX_ALPHA - alphaAbove);
		alphaBComp = +(MAX_ALPHA - alphaBelow);
		// alphaSum   = alphaAbove + alphaBelow;
		// alphaANorm = alphaAbove / alphaSum;
		// alphaBNorm = alphaBelow / alphaSum;

		if ((valueAbove|0) == (ZERO_VALUE|0)) valueResult = valueBelow|0; else
		if ((valueAbove|0) ==  (MAX_VALUE|0)) valueResult = MAX_VALUE|0; else
		if ((valueBelow|0) ==  (MAX_VALUE|0)) valueResult = MAX_VALUE|0;
		else {
			a = +((MAX_VALUE - valueBelow)|0);
			b = +(valueBelow|0);

			valueResult = ~~floor(b + (alphaAbove * a))|0;
		}

		clamp_result();

		// alphaMixed = valueResult / MAX_VALUE;
		// alphaMComp = MAX_ALPHA - alphaMixed;

		return valueResult|0;
	}

	function linear_burn_blend_color(i,j) {
		i = i|0;
		j = j|0;

		var a = 0.0;
		var b = 0.0;
		var c = 0.0;

		valueBelow = uint8[i]|0;
		valueAbove = uint8[j]|0;

//* RGBexpression: C = B + A - 1;

		a = +(valueAbove|0); //* int to double
		b = +(valueBelow|0);
		c = +(((valueAbove|0) - (MAX_VALUE|0))|0);

		valueResult = ~~floor(
			alphaBComp * (
				(alphaAbove * a)
			+	(alphaAComp * b)
			)
		+	alphaBelow * (
				b
			+	(alphaAbove * c)
			)
		); //* double to int

		clamp_result();

		return valueResult|0;
	}

	function linear_light_blend_color(i,j) {
		i = i|0;
		j = j|0;

		var a = 0.0;
		var b = 0.0;
		var c = 0.0;

		valueBelow = uint8[i]|0;
		valueAbove = uint8[j]|0;

//* RGBexpression: C = B + 2*A - 1;

		a = +(valueAbove|0); //* int to double
		b = +(valueBelow|0);
		c = +((((valueAbove|0) << 1) - (MAX_VALUE|0))|0);

		valueResult = ~~floor(
			alphaBComp * (
				(alphaAbove * a)
			+	(alphaAComp * b)
			)
		+	alphaBelow * (
				b
			+	(alphaAbove * c)
			)
		); //* double to int

		clamp_result();

		return valueResult|0;
	}

//* Declare public functions: -------------------------------------------------

	function linear_burn(data_length) {
		data_length = data_length|0;

		reset_vars(data_length);

		do {
			i = (i-4)|0;
			j = (j-4)|0;

			if ((uint8[(i+3)|0]|0) != 0)
			if ((uint8[(j+3)|0]|0) != 0) {
				a = blend_alpha((i+3)|0, (j+3)|0)|0;
				b = linear_burn_blend_color((i+2)|0, (j+2)|0)|0;
				g = linear_burn_blend_color((i+1)|0, (j+1)|0)|0;
				r = linear_burn_blend_color(i|0, j|0)|0;

				uint32[i >> 2] = (
					(r & 0xFF)
				+	((g & 0xFF) << 8)
				+	((b & 0xFF) << 16)
				+	((a & 0xFF) << 24)
				)|0;
			}
		} while (i|0 != 0);
	}

	function linear_light(data_length) {
		data_length = data_length|0;

		reset_vars(data_length);

		do {
			i = (i-4)|0;
			j = (j-4)|0;

			if ((uint8[(i+3)|0]|0) != 0)
			if ((uint8[(j+3)|0]|0) != 0) {
				a = blend_alpha((i+3)|0, (j+3)|0)|0;
				b = linear_light_blend_color((i+2)|0, (j+2)|0)|0;
				g = linear_light_blend_color((i+1)|0, (j+1)|0)|0;
				r = linear_light_blend_color(i|0, j|0)|0;

				uint32[i >> 2] = (
					(r & 0xFF)
				+	((g & 0xFF) << 8)
				+	((b & 0xFF) << 16)
				+	((a & 0xFF) << 24)
				)|0;
			}
		} while (i|0 != 0);
	}

//* Return public functions: --------------------------------------------------

	return {
		linear_burn: linear_burn,
		linear_light: linear_light,
	};
}

/*
TODO:

'darker-color'	[need formula]
'lighter-color'	[need formula]
'divide'
'hard-mix'
'linear-burn'	[done]
'linear-light'	[done]
'pin-light'
'substract'
'vivid-light'

JS-native:

'color-burn'
'color-dodge'
'darken'
'lighten'
'lighter'
'multiply'
'overlay'
'screen'
'soft-light'
'hard-light'

'difference'
'exclusion'

'color'
'hue'
'saturation'
'luminosity'
*/
