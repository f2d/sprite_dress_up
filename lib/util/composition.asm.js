
//* ---------------------------------------------------------------------------
//* I'm testing this code in Firefox 56 and latest Vivaldi (Chromium-based, 2-3x faster blending than ff56 and no PMA).
//* Temp vars are used for readability, and it's not faster without them.
//* ---------------------------------------------------------------------------
//* Notes on avoiding declaring vars inside functions (not sure if it helps or hurts in JS, asm or plain):
//* https://www.reddit.com/r/swift/comments/4flh03/what_are_the_performance_cost_differences_of_let/d2e3ztz/
//* ---------------------------------------------------------------------------



const AsmCompositionModule = function (std, env, heap) {

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

	var floatValueAbove = 0.0;
	var floatValueBelow = 0.0;

	var floatNormalizedAlphaAbove = 0.0;
	var floatNormalizedAlphaBelow = 0.0;
	var floatNormalizedAlphaTrans = 0.0;

	var floatNormalizedValueAbove = 0.0;
	var floatNormalizedValueBelow = 0.0;

	var floatNormalizedInverseAbove = 0.0;
	var floatNormalizedInverseBelow = 0.0;
	var floatNormalizedInverseTrans = 0.0;

	var floatColorRatioAbove = 0.0;
	var floatColorRatioBelow = 0.0;

	var floatTempResult = 0.0;
	var intTempResult = 0;

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

//* Steps to blend colors with transparency:
//* 1) Blend just colors above and below by formula from table.
//* 2) Transit to color below to degree of transparency above.
//* 3) Transit to color above to degree of transparency below.

	function float_opaque_to_transparent_color(float_value) {
		float_value = +float_value;

		if (floatNormalizedAlphaAbove < MAX_NORMALIZED_FLOAT) {
			if (floatNormalizedAlphaAbove > MIN_NORMALIZED_FLOAT) {
				floatValueBelow = +(intValueBelow|0);

				float_value = +(
					(float_value * floatNormalizedAlphaAbove)
				+	(floatValueBelow * (MAX_NORMALIZED_FLOAT - floatNormalizedAlphaAbove))
				);
			} else {
				return intValueBelow|0;
			}
		}

		if (floatNormalizedAlphaBelow < MAX_NORMALIZED_FLOAT) {

			if (floatNormalizedAlphaBelow > MIN_NORMALIZED_FLOAT) {
				floatValueAbove = +(intValueAbove|0);

				float_value = +(
					(float_value * floatNormalizedAlphaBelow)
				+	(floatValueAbove * (MAX_NORMALIZED_FLOAT - floatNormalizedAlphaBelow))
				);
			} else {
				return intValueAbove|0;
			}
		}

		return float_to_int_in_clamped_range(float_value)|0;
	}

	function int_opaque_to_transparent_color(int_value) {
		int_value = int_value|0;

		// return float_opaque_to_transparent_color(+(int_value|0))|0;

//* Compared to just calling float_opaque_to_transparent_color above,
//* the below full int-based code gets occasional 1-bit precision difference in result,
//* but the speed difference is not clear:

		if (floatNormalizedAlphaAbove < MAX_NORMALIZED_FLOAT) {
			if (floatNormalizedAlphaAbove > MIN_NORMALIZED_FLOAT) {
				int_value = ~~floor(
					((+(int_value|0)) * floatNormalizedAlphaAbove)
				+	((+(intValueBelow|0)) * (MAX_NORMALIZED_FLOAT - floatNormalizedAlphaAbove))
				);
			} else {
				return intValueBelow|0;
			}
		}

		if (floatNormalizedAlphaBelow < MAX_NORMALIZED_FLOAT) {
			if (floatNormalizedAlphaBelow > MIN_NORMALIZED_FLOAT) {
				int_value = ~~floor(
					((+(int_value|0)) * floatNormalizedAlphaBelow)
				+	((+(intValueAbove|0)) * (MAX_NORMALIZED_FLOAT - floatNormalizedAlphaBelow))
				);
			} else {
				return intValueAbove|0;
			}
		}

		return int_in_clamped_range(int_value|0)|0;
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

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		floatNormalizedAlphaAbove = +int_to_float_in_normalized_range(intValueAbove);
		floatNormalizedAlphaBelow = +int_to_float_in_normalized_range(intValueBelow);

		if ((intValueAbove|0) == MIN_CLAMPED_INT) return intValueBelow|0;
		if ((intValueAbove|0) == MAX_CLAMPED_INT) return MAX_CLAMPED_INT;
		if ((intValueBelow|0) == MAX_CLAMPED_INT) return MAX_CLAMPED_INT;

		floatNormalizedInverseAbove = +(MAX_NORMALIZED_FLOAT - floatNormalizedAlphaAbove);
		floatNormalizedInverseBelow = +(MAX_NORMALIZED_FLOAT - floatNormalizedAlphaBelow);

		return float_to_int_in_clamped_range(
			MAX_CLAMPED_FLOAT - (
				floatNormalizedInverseAbove *
				floatNormalizedInverseBelow *
				CLAMPED_TO_NORMALIZED_RATIO
			)
		)|0;
	}

//* add formula:
//* C = B + A;

	function blend_color_add(channel) {
		channel = channel|0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		intTempResult = (intValueBelow + intValueAbove)|0;

		return int_opaque_to_transparent_color(intTempResult)|0;
	}

//* subtract formula:
//* C = B - A;

	function blend_color_subtract(channel) {
		channel = channel|0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		intTempResult = (intValueBelow - intValueAbove)|0;

		return int_opaque_to_transparent_color(intTempResult)|0;
	}

//* divide formula:
//* C = B / A;

	function blend_color_divide(channel) {
		channel = channel|0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		if ((intValueAbove|0) == MIN_CLAMPED_INT) {
			intValueAbove = ALMOST_MIN_CLAMPED_INT;	//* <- avoid division by zero
		}

		floatNormalizedValueAbove = +int_to_float_in_normalized_range(intValueAbove);
		floatNormalizedValueBelow = +int_to_float_in_normalized_range(intValueBelow);

		floatTempResult = +(floatNormalizedValueBelow / floatNormalizedValueAbove);

		return float_opaque_to_transparent_color(floatTempResult * CLAMPED_TO_NORMALIZED_RATIO)|0;
	}

//* hard_mix formula:
//* A+B < 1: C = 0;
//* A+B > 1: C = 1;

	function blend_color_hard_mix(channel) {
		channel = channel|0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		if (((intValueAbove + intValueBelow)|0) > MAX_CLAMPED_INT) {
			intTempResult = MAX_CLAMPED_INT;
		} else {
			intTempResult = MIN_CLAMPED_INT;
		}

		return int_opaque_to_transparent_color(intTempResult)|0;
	}

//* linear_burn formula:
//* C = A + B - 1;

	function blend_color_linear_burn(channel) {
		channel = channel|0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		intTempResult = (intValueAbove + intValueBelow - MAX_CLAMPED_INT)|0;

		return int_opaque_to_transparent_color(intTempResult)|0;
	}

//* linear_light formula:
//* C = 2*A + B - 1;

	function blend_color_linear_light(channel) {
		channel = channel|0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		intTempResult = ((intValueAbove << 1) + intValueBelow - MAX_CLAMPED_INT)|0;

		return int_opaque_to_transparent_color(intTempResult)|0;
	}

//* pin_light formula:
//* C = min(max(2*A - 1, B), 2*A)

	function blend_color_pin_light(channel) {
		channel = channel|0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		intTempResult = (intValueAbove << 1)|0;

		if ((intValueBelow|0) > (intTempResult|0)) {
			return int_opaque_to_transparent_color(intTempResult)|0;
		}

		intTempResult = (intTempResult - MAX_CLAMPED_INT)|0;

		if ((intValueBelow|0) < (intTempResult|0)) {
			return int_opaque_to_transparent_color(intTempResult)|0;
		}

		return int_opaque_to_transparent_color(intValueBelow)|0;
	}

//* vivid_light formula:
//* A <= 0.5: C = 1 - (1-B)/(2*A)
//* A >  0.5: C = B / (2*(1-A))

	function blend_color_vivid_light(channel) {
		channel = channel|0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		if ((intValueAbove|0) <= HALF_CLAMPED_INT) {

			if ((intValueAbove|0) == MIN_CLAMPED_INT) {
				intValueAbove = ALMOST_MIN_CLAMPED_INT;	//* <- avoid division by zero
			}

			floatNormalizedInverseBelow = +int_to_float_in_normalized_range((MAX_CLAMPED_INT - intValueBelow)|0);
			floatTempResult = +int_to_float_in_normalized_range(intValueAbove << 1);
			floatTempResult = +(MAX_NORMALIZED_FLOAT - (floatNormalizedInverseBelow / floatTempResult));
		} else {
			if ((intValueAbove|0) == MAX_CLAMPED_INT) {
				intValueAbove = ALMOST_MAX_CLAMPED_INT;	//* <- avoid division by zero
			}

			floatNormalizedValueBelow = +int_to_float_in_normalized_range(intValueBelow);
			floatTempResult = +int_to_float_in_normalized_range((MAX_CLAMPED_INT - intValueAbove) << 1);
			floatTempResult = +(floatNormalizedValueBelow / floatTempResult);
		}

		return float_opaque_to_transparent_color(floatTempResult * CLAMPED_TO_NORMALIZED_RATIO)|0;
	}

//* transit from B to A to the depth of T mask:

	function blend_alpha_transition(channel) {
		channel = channel|0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		floatNormalizedAlphaBelow = +int_to_float_in_normalized_range(intValueBelow);
		floatNormalizedAlphaTrans = +int_to_float_in_normalized_range(intValueTrans);

		floatNormalizedInverseTrans = +(MAX_NORMALIZED_FLOAT - floatNormalizedAlphaTrans);

		floatColorRatioBelow = +(floatNormalizedInverseTrans * floatNormalizedAlphaBelow);
		floatColorRatioAbove = +(MAX_NORMALIZED_FLOAT - floatColorRatioBelow);

		if ((intValueBelow|0) == (intValueAbove|0)) return intValueBelow|0;

		floatValueAbove = +(intValueAbove|0);
		floatValueBelow = +(intValueBelow|0);

		return float_to_int_in_clamped_range(
			(floatValueAbove * floatNormalizedAlphaTrans)
		+	(floatValueBelow * floatNormalizedInverseTrans)
		)|0;
	}

//* transit from A to B to the depth of T mask:

	function blend_alpha_transition_out(channel) {
		channel = channel|0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		floatNormalizedAlphaAbove = +int_to_float_in_normalized_range(intValueAbove);
		floatNormalizedAlphaTrans = +int_to_float_in_normalized_range(intValueTrans);

		floatNormalizedInverseTrans = +(MAX_NORMALIZED_FLOAT - floatNormalizedAlphaTrans);

		floatColorRatioAbove = +(floatNormalizedAlphaTrans * floatNormalizedAlphaAbove);
		floatColorRatioBelow = +(MAX_NORMALIZED_FLOAT - floatColorRatioAbove);

		if ((intValueBelow|0) == (intValueAbove|0)) return intValueBelow|0;

		floatValueAbove = +(intValueAbove|0);
		floatValueBelow = +(intValueBelow|0);

		return float_to_int_in_clamped_range(
			(floatValueAbove * floatNormalizedAlphaTrans)
		+	(floatValueBelow * floatNormalizedInverseTrans)
		)|0;
	}

	function blend_color_transition(channel) {
		channel = channel|0;

		intValueAbove = uint8[indexAbove|channel]|0;
		intValueBelow = uint8[indexBelow|channel]|0;

		if ((intValueBelow|0) == (intValueAbove|0)) return intValueBelow|0;

		floatValueAbove = +(intValueAbove|0);
		floatValueBelow = +(intValueBelow|0);

		return float_to_int_in_clamped_range(
			(floatValueAbove * floatColorRatioAbove)
		+	(floatValueBelow * floatColorRatioBelow)
		)|0;
	}



//* Declare public functions: -------------------------------------------------

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

			intValueTrans = uint8[indexTrans|3]|0;

			if ((intValueTrans|0) == MIN_CLAMPED_INT) continue; else
			if ((intValueTrans|0) == MAX_CLAMPED_INT) {
				uint32[indexBelow >> 2] = uint32[indexAbove >> 2];
			} else
			if (intResultA = blend_alpha_transition(3)|0) {
				intResultB = blend_color_transition(2)|0;
				intResultG = blend_color_transition(1)|0;
				intResultR = blend_color_transition(0)|0;
				save_result();
			} else {
				uint32[indexBelow >> 2] = 0;
			}
		} while (indexBelow|0);
	}

	function run_cycle_transition_out(data_length) {
		data_length = data_length|0;

		init_vars(data_length);

		do {
			indexAbove = (indexAbove - 4)|0;
			indexBelow = (indexBelow - 4)|0;
			indexTrans = (indexTrans - 4)|0;

			intValueTrans = uint8[indexTrans|3]|0;
			// intValueTrans = (MAX_CLAMPED_INT - uint8[indexTrans|3])|0;

			if ((intValueTrans|0) == MIN_CLAMPED_INT) continue; else
			if ((intValueTrans|0) == MAX_CLAMPED_INT) {
				uint32[indexBelow >> 2] = uint32[indexAbove >> 2];
			} else
			if (intResultA = blend_alpha_transition_out(3)|0) {
				intResultB = blend_color_transition(2)|0;
				intResultG = blend_color_transition(1)|0;
				intResultR = blend_color_transition(0)|0;
				save_result();
			} else {
				uint32[indexBelow >> 2] = 0;
			}
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
		add		: run_cycle_add			,	//* <- OK, same as JS "lighter"
		subtract	: run_cycle_subtract		,	//* <- OK
		divide		: run_cycle_divide		,	//* <- OK with opaque bottom or clipping group
		hard_mix	: run_cycle_hard_mix		,	//* <- OK with opaque bottom or clipping group
		linear_burn	: run_cycle_linear_burn		,	//* <- OK with opaque bottom or clipping group
		linear_light	: run_cycle_linear_light	,	//* <- OK with opaque bottom or clipping group
		pin_light	: run_cycle_pin_light		,	//* <- OK with opaque bottom or clipping group
		vivid_light	: run_cycle_vivid_light		,	//* <- OK with opaque bottom or clipping group
		// darker_color	: run_cycle_darker_color	,	//* <- need formula (keep color with lower L in CIE L*a*b model?)
		// lighter_color: run_cycle_lighter_color	,	//* <- need formula (keep color with higher L in CIE L*a*b model?)
		transition	: run_cycle_transition		,	//* <- OK, uses 3 buffers
		transition_in	: run_cycle_transition		,	//* <- OK, uses 3 buffers
		transition_out	: run_cycle_transition_out	,	//* <- OK, uses 3 buffers
		opaque		: run_cycle_opaque		,	//* <- OK, uses 1 buffer, may be slower than normal JS one-liner
	};
}
