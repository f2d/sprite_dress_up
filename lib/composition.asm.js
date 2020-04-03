
function AsmCompositionModule(std, env, heap) {
	'use asm';

//* Declare variables, shared inside module: ----------------------------------

	var abs = std.Math.abs;
	var floor = std.Math.floor;

	var MIN_INT = 0;
	var MAX_INT = 255;

	var ALMOST_MIN_INT = 1;
	var ALMOST_MAX_INT = 254;

	var MIN_INT_FLOAT = 0.0;
	var MAX_INT_FLOAT = 255.0;

	var MIN_FLOAT = 0.0;
	var MAX_FLOAT = 1.0;

	var INT_TO_FLOAT_RATIO = 255.0;

	var valueAbove = 0;
	var valueBelow = 0;

	var valueTMask = 0;
	var valueTFrom = 0;

	var alphaAbove = 0.0;
	var alphaBelow = 0.0;

	var i = 0;
	var j = 0;
	var k = 0;

	var r = 0;
	var g = 0;
	var b = 0;
	var a = 0;

	var uint8  = new std.Uint8Array (heap);	//* <- to read RGBA pixel data
	var uint32 = new std.Uint32Array(heap);	//* <- to write result back

//* Declare functions, shared inside module: ----------------------------------

	function init_vars(data_length) {
		data_length = data_length|0;

		i = data_length|0;
		j = (i << 1)|0;
	}

//* Additional function calls like the following can add difference in total work time.
//* But resulting slowdown seems only marginal, not even sure if noticeable.
//* Try "<...>_optimized" functions to compare.

	function i2f(i) {
		i = i|0;		 //* <- int

//* No real need for edge cases without clamping,
//* and clamping at this stage ruins everything.

		// if ((i|0) == (MIN_INT|0)) return +MIN_INT_FLOAT;
		// if ((i|0) == (MAX_INT|0)) return +MAX_INT_FLOAT;

		return +(i|0);		//* <- int to double
	}

	function i2f1(i) {
		i = i|0;

		// if ((i|0) == (MIN_INT|0)) return +MIN_FLOAT;
		// if ((i|0) == (MAX_INT|0)) return +MAX_FLOAT;

		return +((+(i|0)) / INT_TO_FLOAT_RATIO);
	}

	function i_clamp(i) {
		i = i|0;

		if ((i|0) <= (MIN_INT|0)) return MIN_INT|0;
		if ((i|0) >= (MAX_INT|0)) return MAX_INT|0;

		return i|0;
	}

	function f2i_clamp(f) {
		f = +f;			//* <- double

		if (f <= MIN_INT_FLOAT) return MIN_INT|0;
		if (f >= MAX_INT_FLOAT) return MAX_INT|0;

		return ~~floor(f);	//* <- double to int
	}

	function f12v(b, c) {
		b = +b;		//* <- valueBelow
		c = +c;		//* <- opaqueResult

		if (alphaAbove != MAX_FLOAT) {
			c = +(((c - b) * alphaAbove) + b);
		}

		return f2i_clamp(c * INT_TO_FLOAT_RATIO)|0;
	}

	function i2v(ib, ic) {
		ib = ib|0;	//* <- valueBelow
		ic = ic|0;	//* <- opaqueResult

		var b = 0.0;
		var c = 0.0;

		if (alphaAbove == MAX_FLOAT) return i_clamp(ic)|0;

		b = +i2f(ib);
		c = +i2f(ic);
		c = +(((c - b) * alphaAbove) + b);

		return f2i_clamp(c)|0;
	}

	function save_result() {
		uint32[i >> 2] = (
			r
		|	(g << 8)
		|	(b << 16)
		|	(a << 24)
		)|0;
	}

	function blend_alpha(channel) {
		channel = channel|0;

		var a = 0.0;
		var b = 0.0;

		valueAbove = uint8[j|channel]|0;
		valueBelow = uint8[i|channel]|0;

		alphaAbove = +i2f1(valueAbove);
		// alphaBelow = +i2f1(valueBelow);

		if ((valueAbove|0) == (MIN_INT|0)) return valueBelow|0;
		if ((valueAbove|0) == (MAX_INT|0)) return MAX_INT|0;
		if ((valueBelow|0) == (MAX_INT|0)) return MAX_INT|0;

		a = +((MAX_INT - valueBelow)|0);
		b = +(valueBelow|0);

		return f2i_clamp((a * alphaAbove) + b)|0;
	}

//* add formula:
//* C = B + A;

	function blend_color_add(channel) {
		channel = channel|0;

		var opaqueResult = 0;

		valueAbove = uint8[j|channel]|0;
		valueBelow = uint8[i|channel]|0;

		opaqueResult = (valueBelow + valueAbove)|0;

		return i2v(valueBelow, opaqueResult)|0;
	}

//* substract formula:
//* C = B - A; (?)

	function blend_color_substract(channel) {
		channel = channel|0;

		var opaqueResult = 0;

		valueAbove = uint8[j|channel]|0;
		valueBelow = uint8[i|channel]|0;

		opaqueResult = (valueBelow - valueAbove)|0;

		return i2v(valueBelow, opaqueResult)|0;
	}

//* divide formula:
//* C = B / A; (?)

	function blend_color_divide(channel) {
		channel = channel|0;

		var a = 0.0;
		var b = 0.0;
		var opaqueResult = 0.0;

		valueAbove = uint8[j|channel]|0;
		valueBelow = uint8[i|channel]|0;

		if ((valueAbove|0) == (MIN_INT|0)) valueAbove = ALMOST_MIN_INT;	//* <- avoid division by zero

		a = +i2f1(valueAbove);
		b = +i2f1(valueBelow);

		opaqueResult = +(b / a);

		return f12v(b, opaqueResult)|0;
	}

//* hard_mix formula:
//* A+B < 1: C = 0;
//* A+B > 1: C = 1;

	function blend_color_hard_mix(channel) {
		channel = channel|0;

		var opaqueResult = 0;

		valueAbove = uint8[j|channel]|0;
		valueBelow = uint8[i|channel]|0;

		if (((valueAbove + valueBelow)|0) > (MAX_INT|0)) {
			opaqueResult = MAX_INT|0;
		}

		return i2v(valueBelow, opaqueResult)|0;
	}

//* linear_burn formula:
//* C = A + B - 1;

	function blend_color_linear_burn(channel) {
		channel = channel|0;

		var opaqueResult = 0;

		valueAbove = uint8[j|channel]|0;
		valueBelow = uint8[i|channel]|0;

		opaqueResult = (valueAbove + valueBelow - MAX_INT)|0;

		return i2v(valueBelow, opaqueResult)|0;
	}

	/*function blend_color_linear_burn_optimized(channel) {
		channel = channel|0;

		var a = 0.0;
		var b = 0.0;

		valueAbove = uint8[j|channel]|0;
		valueBelow = uint8[i|channel]|0;

		a = +((valueAbove - MAX_INT)|0);
		b = +(valueBelow|0);

		return f2i_clamp((a * alphaAbove) + b)|0;
	}*/

//* linear_light formula:
//* C = 2*A + B - 1;

	function blend_color_linear_light(channel) {
		channel = channel|0;

		var opaqueResult = 0;

		valueAbove = uint8[j|channel]|0;
		valueBelow = uint8[i|channel]|0;

		opaqueResult = ((valueAbove << 1) + valueBelow - MAX_INT)|0;

		return i2v(valueBelow, opaqueResult)|0;
	}

	/*function blend_color_linear_light_optimized(channel) {
		channel = channel|0;

		var a = 0.0;
		var b = 0.0;

		valueAbove = uint8[j|channel]|0;
		valueBelow = uint8[i|channel]|0;

		a = +(((valueAbove << 1) - MAX_INT)|0);
		b = +(valueBelow|0);

		return f2i_clamp((a * alphaAbove) + b)|0;
	}*/

//* pin_light formula:
//* C = min(max(2*A - 1, B), 2*A)

	function blend_color_pin_light(channel) {
		channel = channel|0;

		var a = 0;
		var b = 0;

		valueAbove = uint8[j|channel]|0;
		valueBelow = uint8[i|channel]|0;

		a = (valueAbove << 1)|0;
		b = (a - MAX_INT)|0;

		if ((valueBelow|0) < (b|0)) return i2v(valueBelow, b)|0;
		if ((valueBelow|0) > (a|0)) return i2v(valueBelow, a)|0;

		return valueBelow|0;
	}

//* vivid_light formula:
//* A <= 0.5: C = 1 - (1-B)/(2*A)
//* A >  0.5: C = B / (2*(1-A))

	function blend_color_vivid_light(channel) {
		channel = channel|0;

		var a = 0.0;
		var b = 0.0;
		var c = 0.0;

		var opaqueResult = 0.0;

		valueAbove = uint8[j|channel]|0;
		valueBelow = uint8[i|channel]|0;

		b = +i2f1(valueBelow);

		if ((valueAbove|0) < 128) {

			if ((valueAbove|0) == (MIN_INT|0)) valueAbove = ALMOST_MIN_INT;	//* <- avoid division by zero

			a = +i2f1(valueAbove << 1);
			c = +i2f1((MAX_INT - valueBelow)|0);

			opaqueResult = +(MAX_FLOAT - (c / a));
		} else {
			if ((valueAbove|0) == (MAX_INT|0)) valueAbove = ALMOST_MAX_INT;	//* <- avoid division by zero

			a = +i2f1((MAX_INT - valueAbove) << 1);

			opaqueResult = +(b / a);
		}

		return f12v(b, opaqueResult)|0;
	}

//* transit from B to A to the depth of T mask:

	function blend_transition(channel) {
		channel = channel|0;

		var a = 0.0;
		var b = 0.0;
		var m = 0.0;
		var n = 0.0;

		valueAbove = uint8[j|channel]|0;
		valueBelow = uint8[i|channel]|0;

		if ((valueTMask|0) == (MIN_INT|0)) return valueBelow|0;
		if ((valueTMask|0) == (MAX_INT|0)) return valueAbove|0;

		a = +(valueAbove|0);
		b = +(valueBelow|0);
		m = +(valueTMask|0);
		n = +(valueTFrom|0);

		return f2i_clamp(((a * m) + (b * n)) / MAX_INT_FLOAT)|0;
	}

//* Declare public functions: -------------------------------------------------

	function run_cycle_divide(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			i = (i-4)|0;
			j = (j-4)|0;

			if (uint8[j|3]|0) {
				if (uint8[i|3]|0) {
					if (a = blend_alpha(3)|0) {
						b = blend_color_divide(2)|0;
						g = blend_color_divide(1)|0;
						r = blend_color_divide(0)|0;
						save_result();
					} else uint32[i >> 2] = 0;
				} else uint32[i >> 2] = uint32[j >> 2];
			}
		} while (i|0);
	}

	function run_cycle_hard_mix(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			i = (i-4)|0;
			j = (j-4)|0;

			if (uint8[j|3]|0) {
				if (uint8[i|3]|0) {
					if (a = blend_alpha(3)|0) {
						b = blend_color_hard_mix(2)|0;
						g = blend_color_hard_mix(1)|0;
						r = blend_color_hard_mix(0)|0;
						save_result();
					} else uint32[i >> 2] = 0;
				} else uint32[i >> 2] = uint32[j >> 2];
			}
		} while (i|0);
	}

	function run_cycle_linear_burn(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			i = (i-4)|0;
			j = (j-4)|0;

			if (uint8[j|3]|0) {
				if (uint8[i|3]|0) {
					if (a = blend_alpha(3)|0) {
						b = blend_color_linear_burn(2)|0;
						g = blend_color_linear_burn(1)|0;
						r = blend_color_linear_burn(0)|0;
						save_result();
					} else uint32[i >> 2] = 0;
				} else uint32[i >> 2] = uint32[j >> 2];
			}
		} while (i|0);
	}

	function run_cycle_linear_light(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			i = (i-4)|0;
			j = (j-4)|0;

			if (uint8[j|3]|0) {
				if (uint8[i|3]|0) {
					if (a = blend_alpha(3)|0) {
						b = blend_color_linear_light(2)|0;
						g = blend_color_linear_light(1)|0;
						r = blend_color_linear_light(0)|0;
						save_result();
					} else uint32[i >> 2] = 0;
				} else uint32[i >> 2] = uint32[j >> 2];
			}
		} while (i|0);
	}

	function run_cycle_pin_light(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			i = (i-4)|0;
			j = (j-4)|0;

			if (uint8[j|3]|0) {
				if (uint8[i|3]|0) {
					if (a = blend_alpha(3)|0) {
						b = blend_color_pin_light(2)|0;
						g = blend_color_pin_light(1)|0;
						r = blend_color_pin_light(0)|0;
						save_result();
					} else uint32[i >> 2] = 0;
				} else uint32[i >> 2] = uint32[j >> 2];
			}
		} while (i|0);
	}

	function run_cycle_add(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			i = (i-4)|0;
			j = (j-4)|0;

			if (uint8[j|3]|0) {
				if (uint8[i|3]|0) {
					if (a = blend_alpha(3)|0) {
						b = blend_color_add(2)|0;
						g = blend_color_add(1)|0;
						r = blend_color_add(0)|0;
						save_result();
					} else uint32[i >> 2] = 0;
				} else uint32[i >> 2] = uint32[j >> 2];
			}
		} while (i|0);
	}

	function run_cycle_substract(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			i = (i-4)|0;
			j = (j-4)|0;

			if (uint8[j|3]|0) {
				if (uint8[i|3]|0) {
					if (a = blend_alpha(3)|0) {
						b = blend_color_substract(2)|0;
						g = blend_color_substract(1)|0;
						r = blend_color_substract(0)|0;
						save_result();
					} else uint32[i >> 2] = 0;
				} else uint32[i >> 2] = uint32[j >> 2];
			}
		} while (i|0);
	}

	function run_cycle_vivid_light(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			i = (i-4)|0;
			j = (j-4)|0;

			if (uint8[j|3]|0) {
				if (uint8[i|3]|0) {
					if (a = blend_alpha(3)|0) {
						b = blend_color_vivid_light(2)|0;
						g = blend_color_vivid_light(1)|0;
						r = blend_color_vivid_light(0)|0;
						save_result();
					} else uint32[i >> 2] = 0;
				} else uint32[i >> 2] = uint32[j >> 2];
			}
		} while (i|0);
	}

	function run_cycle_transition(data_length) {
		data_length = data_length|0;

		i = data_length|0;	//* <- RGBA array length
		j = (i + i)|0;		//* <- RGBA array length x2
		k = (i + j)|0;		//* <- RGBA array length x3

		do {
			i = (i-4)|0;
			j = (j-4)|0;
			k = (k-4)|0;

			valueTMask = uint8[k|3]|0;
			valueTFrom = (MAX_INT - valueTMask)|0;

			a = blend_transition(3)|0;
			b = blend_transition(2)|0;
			g = blend_transition(1)|0;
			r = blend_transition(0)|0;

			save_result();
		} while (i|0);
	}

	function run_cycle_opaque(i) {
		i = i|0;

		do {
			i = (i-4)|0;
			uint8[i|3] = MAX_INT;
		} while (i|0);
	}

//* Return references to public functions, callable from outside: -------------

	return {
		linear_burn	: run_cycle_linear_burn		,	//* <- OK with opaque bottom or clipping group
		linear_light	: run_cycle_linear_light	,	//* <- OK with opaque bottom or clipping group
		pin_light	: run_cycle_pin_light		,	//* <- not verified
		vivid_light	: run_cycle_vivid_light		,	//* <- not verified
		add		: run_cycle_add			,	//* <- OK with opaque bottom or clipping group, same as "lighter"
		substract	: run_cycle_substract		,	//* <- not verified
		divide		: run_cycle_divide		,	//* <- wrong
		hard_mix	: run_cycle_hard_mix		,	//* <- wrong
		// darker_color	: run_cycle_darker_color	,	//* <- need formula
		// lighter_color: run_cycle_lighter_color	,	//* <- need formula
		transition	: run_cycle_transition		,	//* <- uses 3 buffers
		opaque		: run_cycle_opaque		,	//* <- uses 1 buffer, may be slower than normal JS one-liner
	};
}
