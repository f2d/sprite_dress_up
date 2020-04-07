
function AsmCompositionModule(std, env, heap) {
	'use asm';



//* Declare outside API references: -------------------------------------------

	const abs = std.Math.abs;
	const floor = std.Math.floor;



//* Declare constants, shared inside module: ----------------------------------

	const MIN_CLAMPED_INT = 0;
	const MAX_CLAMPED_INT = 255;

	const HALF_CLAMPED_INT = 127;

	const ALMOST_MIN_CLAMPED_INT = 1;
	const ALMOST_MAX_CLAMPED_INT = 254;

	const MIN_CLAMPED_FLOAT = 0.0;
	const MAX_CLAMPED_FLOAT = 255.0;

	const MIN_NORMALIZED_FLOAT = 0.0;
	const MAX_NORMALIZED_FLOAT = 1.0;

	const CLAMPED_TO_NORMALIZED_RATIO = 255.0;



//* Declare variables, shared inside module: ----------------------------------

	var indexAbove = 0;
	var indexBelow = 0;
	var indexTrans = 0;

	var intValueAbove = 0;
	var intValueBelow = 0;
	var intValueTrans = 0;

	var normalizedAlphaAbove = 0.0;
	var normalizedAlphaBelow = 0.0;

	var colorRatioAbove = 0.0;
	var colorRatioBelow = 0.0;

	var intResultR = 0;
	var intResultG = 0;
	var intResultB = 0;
	var intResultA = 0;

	var uint8  = new std.Uint8Array (heap);	//* <- to read RGBA pixel data
	var uint32 = new std.Uint32Array(heap);	//* <- to write result back



//* Declare functions, shared inside module: ----------------------------------

	function init_vars(data_length) {
		data_length = data_length|0;

		indexBelow = data_length|0;			//* <- RGBA array length
		indexAbove = (indexBelow + indexBelow)|0;	//* <- RGBA array length x2
		indexTrans = (indexBelow + indexAbove)|0;	//* <- RGBA array length x3
	}

//* Additional function calls like the following can add difference in total work time.
//* But resulting slowdown seems only marginal, not even sure if noticeable.

	function int_to_float(int_value) {
		int_value = int_value|0;	//* <- int

		return +(int_value|0);		//* <- int to double
	}

	function int_to_float_in_normalized_range(int_value) {
		int_value = int_value|0;

		return +((+(int_value|0)) / CLAMPED_TO_NORMALIZED_RATIO);
	}

	function int_in_clamped_range(int_value) {
		int_value = int_value|0;

		if ((int_value|0) <= MIN_CLAMPED_INT) return MIN_CLAMPED_INT;
		if ((int_value|0) >= MAX_CLAMPED_INT) return MAX_CLAMPED_INT;

		return int_value|0;
	}

	function float_to_int_in_clamped_range(float_value) {
		float_value = +float_value;	//* <- double

		if (float_value <= MIN_CLAMPED_FLOAT) return MIN_CLAMPED_INT;
		if (float_value >= MAX_CLAMPED_FLOAT) return MAX_CLAMPED_INT;

		return ~~floor(float_value);	//* <- double to int
	}

	function float_in_normalized_range_opaque_to_transparent_color(float_before, float_after) {
		float_before = +float_before;
		float_after  = +float_after;

		if (colorRatioAbove <= MIN_NORMALIZED_FLOAT) {
			float_after = +float_before;
		} else
		if (colorRatioAbove < MAX_NORMALIZED_FLOAT) {
			float_after = +(
				(float_after  * colorRatioAbove)
			+	(float_before * colorRatioBelow)
			);
		}


		return float_to_int_in_clamped_range(float_after * CLAMPED_TO_NORMALIZED_RATIO)|0;
	}

	function int_opaque_to_transparent_color(int_before, int_after) {
		int_before = int_before|0;
		int_after  = int_after|0;

		var float_before = 0.0;
		var float_after  = 0.0;

		if (colorRatioAbove <= MIN_NORMALIZED_FLOAT) {
			return int_in_clamped_range(int_before)|0;
		} else
		if (colorRatioAbove >= MAX_NORMALIZED_FLOAT) {
			return int_in_clamped_range(int_after)|0;
		}

		float_before = +(int_before|0);
		float_after  = +(int_after|0);

		float_after = +(
			(float_after  * colorRatioAbove)
		+	(float_before * colorRatioBelow)
		);

		return float_to_int_in_clamped_range(float_after)|0;
	}

	function save_result() {
		uint32[indexBelow >> 2] = (
			intResultR
		|	(intResultG << 8)
		|	(intResultB << 16)
		|	(intResultA << 24)
		)|0;
	}

//* multiply inverse normalized alpha:
//* https://stackoverflow.com/a/6386389

	function blend_alpha(channel) {
		channel = channel|0;

		var inverse_a = 0.0;
		var inverse_b = 0.0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		normalizedAlphaAbove = +int_to_float_in_normalized_range(intValueAbove);
		normalizedAlphaBelow = +int_to_float_in_normalized_range(intValueBelow);

		inverse_a = +(MAX_NORMALIZED_FLOAT - normalizedAlphaAbove);

		colorRatioBelow = +(inverse_a * normalizedAlphaBelow);
		colorRatioAbove = +(MAX_NORMALIZED_FLOAT - colorRatioBelow);

		if ((intValueAbove|0) == MIN_CLAMPED_INT) return intValueBelow|0;
		if ((intValueAbove|0) == MAX_CLAMPED_INT) return MAX_CLAMPED_INT;
		if ((intValueBelow|0) == MAX_CLAMPED_INT) return MAX_CLAMPED_INT;

		inverse_b = +(MAX_NORMALIZED_FLOAT - normalizedAlphaBelow);

		return float_to_int_in_clamped_range(MAX_CLAMPED_FLOAT - (inverse_a * inverse_b * CLAMPED_TO_NORMALIZED_RATIO))|0;
	}

//* add formula:
//* C = B + A;

	function blend_color_add(channel) {
		channel = channel|0;

		var int_after = 0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		int_after = (intValueBelow + intValueAbove)|0;

		return int_opaque_to_transparent_color(intValueBelow, int_after)|0;
	}

//* subtract formula:
//* C = B - A;

	function blend_color_subtract(channel) {
		channel = channel|0;

		var int_after = 0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		int_after = (intValueBelow - intValueAbove)|0;

		return int_opaque_to_transparent_color(intValueBelow, int_after)|0;
	}

//* divide formula:
//* C = B / A;

	function blend_color_divide(channel) {
		channel = channel|0;

		var float_a = 0.0;
		var float_b = 0.0;
		var float_after = 0.0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		if ((intValueAbove|0) == MIN_CLAMPED_INT) {
			intValueAbove = ALMOST_MIN_CLAMPED_INT;	//* <- avoid division by zero
		}

		float_a = +int_to_float_in_normalized_range(intValueAbove);
		float_b = +int_to_float_in_normalized_range(intValueBelow);

		float_after = +(float_b / float_a);

		return float_in_normalized_range_opaque_to_transparent_color(float_b, float_after)|0;
	}

//* hard_mix formula:
//* A+B < 1: C = 0;
//* A+B > 1: C = 1;

	function blend_color_hard_mix(channel) {
		channel = channel|0;

		var int_after = MIN_CLAMPED_INT;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		if (((intValueAbove + intValueBelow)|0) > MAX_CLAMPED_INT) {
			int_after = MAX_CLAMPED_INT;
		}

		return int_opaque_to_transparent_color(intValueBelow, int_after)|0;
	}

//* linear_burn formula:
//* C = A + B - 1;

	function blend_color_linear_burn(channel) {
		channel = channel|0;

		var int_after = 0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		int_after = (intValueAbove + intValueBelow - MAX_CLAMPED_INT)|0;

		return int_opaque_to_transparent_color(intValueBelow, int_after)|0;
	}

//* linear_light formula:
//* C = 2*A + B - 1;

	function blend_color_linear_light(channel) {
		channel = channel|0;

		var int_after = 0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		int_after = ((intValueAbove << 1) + intValueBelow - MAX_CLAMPED_INT)|0;

		return int_opaque_to_transparent_color(intValueBelow, int_after)|0;
	}

//* pin_light formula:
//* C = min(max(2*A - 1, B), 2*A)

	function blend_color_pin_light(channel) {
		channel = channel|0;

		var int_a = 0;
		var int_b = 0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		int_a = (intValueAbove << 1)|0;
		int_b = (int_a - MAX_CLAMPED_INT)|0;

		if ((intValueBelow|0) < (int_b|0)) return int_opaque_to_transparent_color(intValueBelow, int_b)|0;
		if ((intValueBelow|0) > (int_a|0)) return int_opaque_to_transparent_color(intValueBelow, int_a)|0;

		return intValueBelow|0;
	}

//* vivid_light formula:
//* A <= 0.5: C = 1 - (1-B)/(2*A)
//* A >  0.5: C = B / (2*(1-A))

	function blend_color_vivid_light(channel) {
		channel = channel|0;

		var double_a = 0.0;
		var float_b = 0.0;
		var inverse_b = 0.0;
		var float_after = 0.0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		float_b = +int_to_float_in_normalized_range(intValueBelow);

		if ((intValueAbove|0) <= HALF_CLAMPED_INT) {

			if ((intValueAbove|0) == MIN_CLAMPED_INT) {
				intValueAbove = ALMOST_MIN_CLAMPED_INT;	//* <- avoid division by zero
			}

			double_a = +int_to_float_in_normalized_range(intValueAbove << 1);
			inverse_b = +int_to_float_in_normalized_range((MAX_CLAMPED_INT - intValueBelow)|0);

			float_after = +(MAX_NORMALIZED_FLOAT - (inverse_b / double_a));
		} else {
			if ((intValueAbove|0) == MAX_CLAMPED_INT) {
				intValueAbove = ALMOST_MAX_CLAMPED_INT;	//* <- avoid division by zero
			}

			double_a = +int_to_float_in_normalized_range((MAX_CLAMPED_INT - intValueAbove) << 1);

			float_after = +(float_b / double_a);
		}

		return float_in_normalized_range_opaque_to_transparent_color(float_b, float_after)|0;
	}

//* transit from B to A to the depth of T mask:

	function blend_alpha_transition(channel) {
		channel = channel|0;

		var float_a = 0.0;
		var float_b = 0.0;
		var inverse_a = 0.0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;
		intValueTrans = uint8[indexTrans|channel]|0;

		if ((intValueTrans|0) == MIN_CLAMPED_INT) return intValueBelow|0;
		if ((intValueTrans|0) == MAX_CLAMPED_INT) return intValueAbove|0;

		normalizedAlphaBelow = +int_to_float_in_normalized_range(intValueBelow);
		normalizedAlphaAbove = +int_to_float_in_normalized_range(intValueTrans);

		inverse_a = +(MAX_NORMALIZED_FLOAT - normalizedAlphaAbove);

		colorRatioBelow = +(inverse_a * normalizedAlphaBelow);
		colorRatioAbove = +(MAX_NORMALIZED_FLOAT - colorRatioBelow);

		if ((intValueBelow|0) == (intValueAbove|0)) return intValueBelow|0;

		float_a = +(intValueAbove|0);
		float_b = +(intValueBelow|0);

		return float_to_int_in_clamped_range((float_a * normalizedAlphaAbove) + (float_b * inverse_a))|0;
	}

	function blend_color_transition(channel) {
		channel = channel|0;

		var float_a = 0.0;
		var float_b = 0.0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		if ((intValueBelow|0) == (intValueAbove|0)) return intValueBelow|0;
		if ((intValueTrans|0) == MIN_CLAMPED_INT) return intValueBelow|0;
		if ((intValueTrans|0) == MAX_CLAMPED_INT) return intValueAbove|0;

		float_a = +(intValueAbove|0);
		float_b = +(intValueBelow|0);

		return float_to_int_in_clamped_range((float_a * colorRatioAbove) + (float_b * colorRatioBelow))|0;
	}



//* Declare public functions: -------------------------------------------------

	function run_cycle_divide(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			indexAbove = (indexAbove - 4)|0;
			indexBelow = (indexBelow - 4)|0;

			if (uint8[indexAbove|3]|0) {
				if (uint8[indexBelow|3]|0) {
					if (intResultA = blend_alpha(3)|0) {
						intResultB = blend_color_divide(2)|0;
						intResultG = blend_color_divide(1)|0;
						intResultR = blend_color_divide(0)|0;
						save_result();
					} else uint32[indexBelow >> 2] = 0;
				} else uint32[indexBelow >> 2] = uint32[indexAbove >> 2];
			}
		} while (indexBelow|0);
	}

	function run_cycle_hard_mix(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			indexAbove = (indexAbove - 4)|0;
			indexBelow = (indexBelow - 4)|0;

			if (uint8[indexAbove|3]|0) {
				if (uint8[indexBelow|3]|0) {
					if (intResultA = blend_alpha(3)|0) {
						intResultB = blend_color_hard_mix(2)|0;
						intResultG = blend_color_hard_mix(1)|0;
						intResultR = blend_color_hard_mix(0)|0;
						save_result();
					} else uint32[indexBelow >> 2] = 0;
				} else uint32[indexBelow >> 2] = uint32[indexAbove >> 2];
			}
		} while (indexBelow|0);
	}

	function run_cycle_linear_burn(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			indexAbove = (indexAbove - 4)|0;
			indexBelow = (indexBelow - 4)|0;

			if (uint8[indexAbove|3]|0) {
				if (uint8[indexBelow|3]|0) {
					if (intResultA = blend_alpha(3)|0) {
						intResultB = blend_color_linear_burn(2)|0;
						intResultG = blend_color_linear_burn(1)|0;
						intResultR = blend_color_linear_burn(0)|0;
						save_result();
					} else uint32[indexBelow >> 2] = 0;
				} else uint32[indexBelow >> 2] = uint32[indexAbove >> 2];
			}
		} while (indexBelow|0);
	}

	function run_cycle_linear_light(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			indexAbove = (indexAbove - 4)|0;
			indexBelow = (indexBelow - 4)|0;

			if (uint8[indexAbove|3]|0) {
				if (uint8[indexBelow|3]|0) {
					if (intResultA = blend_alpha(3)|0) {
						intResultB = blend_color_linear_light(2)|0;
						intResultG = blend_color_linear_light(1)|0;
						intResultR = blend_color_linear_light(0)|0;
						save_result();
					} else uint32[indexBelow >> 2] = 0;
				} else uint32[indexBelow >> 2] = uint32[indexAbove >> 2];
			}
		} while (indexBelow|0);
	}

	function run_cycle_pin_light(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			indexAbove = (indexAbove - 4)|0;
			indexBelow = (indexBelow - 4)|0;

			if (uint8[indexAbove|3]|0) {
				if (uint8[indexBelow|3]|0) {
					if (intResultA = blend_alpha(3)|0) {
						intResultB = blend_color_pin_light(2)|0;
						intResultG = blend_color_pin_light(1)|0;
						intResultR = blend_color_pin_light(0)|0;
						save_result();
					} else uint32[indexBelow >> 2] = 0;
				} else uint32[indexBelow >> 2] = uint32[indexAbove >> 2];
			}
		} while (indexBelow|0);
	}

	function run_cycle_add(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			indexAbove = (indexAbove - 4)|0;
			indexBelow = (indexBelow - 4)|0;

			if (uint8[indexAbove|3]|0) {
				if (uint8[indexBelow|3]|0) {
					if (intResultA = blend_alpha(3)|0) {
						intResultB = blend_color_add(2)|0;
						intResultG = blend_color_add(1)|0;
						intResultR = blend_color_add(0)|0;
						save_result();
					} else uint32[indexBelow >> 2] = 0;
				} else uint32[indexBelow >> 2] = uint32[indexAbove >> 2];
			}
		} while (indexBelow|0);
	}

	function run_cycle_subtract(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			indexAbove = (indexAbove - 4)|0;
			indexBelow = (indexBelow - 4)|0;

			if (uint8[indexAbove|3]|0) {
				if (uint8[indexBelow|3]|0) {
					if (intResultA = blend_alpha(3)|0) {
						intResultB = blend_color_subtract(2)|0;
						intResultG = blend_color_subtract(1)|0;
						intResultR = blend_color_subtract(0)|0;
						save_result();
					} else uint32[indexBelow >> 2] = 0;
				} else uint32[indexBelow >> 2] = uint32[indexAbove >> 2];
			}
		} while (indexBelow|0);
	}

	function run_cycle_vivid_light(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			indexAbove = (indexAbove - 4)|0;
			indexBelow = (indexBelow - 4)|0;

			if (uint8[indexAbove|3]|0) {
				if (uint8[indexBelow|3]|0) {
					if (intResultA = blend_alpha(3)|0) {
						intResultB = blend_color_vivid_light(2)|0;
						intResultG = blend_color_vivid_light(1)|0;
						intResultR = blend_color_vivid_light(0)|0;
						save_result();
					} else uint32[indexBelow >> 2] = 0;
				} else uint32[indexBelow >> 2] = uint32[indexAbove >> 2];
			}
		} while (indexBelow|0);
	}

	function run_cycle_transition(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			indexAbove = (indexAbove - 4)|0;
			indexBelow = (indexBelow - 4)|0;
			indexTrans = (indexTrans - 4)|0;

			if (intResultA = blend_alpha_transition(3)|0) {
				intResultB = blend_color_transition(2)|0;
				intResultG = blend_color_transition(1)|0;
				intResultR = blend_color_transition(0)|0;
				save_result();
			} else uint32[indexBelow >> 2] = 0;
		} while (indexBelow|0);
	}

	function run_cycle_opaque(indexBelow) {
		indexBelow = indexBelow|0;

		do {
			indexBelow = (indexBelow - 4)|0;
			uint8[indexBelow|3] = MAX_CLAMPED_INT;
		} while (indexBelow|0);
	}



//* Return references to public functions, callable from outside: -------------

	return {
		linear_burn	: run_cycle_linear_burn		,	//* <- OK with opaque bottom or clipping group
		linear_light	: run_cycle_linear_light	,	//* <- OK with opaque bottom or clipping group
		pin_light	: run_cycle_pin_light		,	//* <- not verified
		vivid_light	: run_cycle_vivid_light		,	//* <- not verified
		add		: run_cycle_add			,	//* <- OK with opaque bottom or clipping group, same as JS "lighter"
		subtract	: run_cycle_subtract		,	//* <- not verified
		divide		: run_cycle_divide		,	//* <- wrong
		hard_mix	: run_cycle_hard_mix		,	//* <- wrong
		// darker_color	: run_cycle_darker_color	,	//* <- need formula
		// lighter_color: run_cycle_lighter_color	,	//* <- need formula
		transition	: run_cycle_transition		,	//* <- uses 3 buffers, OK
		opaque		: run_cycle_opaque		,	//* <- uses 1 buffer, may be slower than normal JS one-liner
	};
}
