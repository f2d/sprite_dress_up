
function getLocalizedCaseByCount(num) {
const	absValue = Math.abs(num)
,	numPartUnder100 = absValue % 100
,	numPartUnder10 = absValue % 10
,	numPartFraction = absValue % 1
	;

	if (
		(numPartUnder100 > 10 && numPartUnder100 < 20)
	||	(numPartUnder10 !== 1)
	||	(numPartFraction > 0)
	) {
		return 'plural';
	}

	return 'singular';
}

const LOCALIZATION_TEXT = {
	'file': 'File',
	'file_select_project': 'Drag and drop a project file onto this page, or select here',
	'file_formats': 'Supported file types',
	'file_notes': [
		'Notes:',
		'ZIP-files are loaded as ORA, if their content is conforming.',
		'If multiple files with same name are opened, earlier ones will close.',
	],

	'examples': 'Examples',
	'examples_notice': [
		'Notice:',
		'The files here are only for reference.',
		'Do not reuse without permission.',
	],

	'psd_from_sai2': 'SAI2 → PSD as is',
	'ora_mockup': 'SAI2 → PSD → Krita (no clipping) → ORA (no masks) → manual fixes',
	'from_paint.net': 'paint.net (with plugins) → PSD and ORA as is (no folders)',

	'about': 'About',
	'about_source': 'Source code, discuss issues and requests',
	'about_lang': 'This page in different languages',
	'about_notes': [
		'Notes:',
		'Chrome-based browsers are recommended for this page.',,
		'Firefox, for example, stores colors on canvas as premultiplied with alpha for faster display,',
		'which hurts blending precision and results in color-banded gradients, which were supposed to be smooth.',,
		'There is plan to later add high-precision rendering without relying on browser built-in algorithms.',
	],

	'help': 'Manual',

	'save_all_projects': 'Save all opened projects',
	'save_all_ora': 'Save to ORA',
	'save_all_png': 'Save to PNG',
	'save_all_png_batch': 'Save all variants to PNG',

	'close_all_projects': 'Close all opened projects',
	'close_all_with_no_var': 'Only with no variants',
	'close_all_with_errors': 'Only with errors',
	'close_all': 'Close all',

	'download_file': 'Download file',
	'download_all': 'Download all',
	'open_example_file': 'Show example',
	'open_example_all': 'Show all',
	'stop': 'Stop (Esc)',

	'open_same_name': 'If opening file has the same name as one of already opened',
	'ask': 'Ask',
	'skip': 'Skip',
	'replace': 'Replace',
	'replace_old': 'Replace if older',

	'file_bytes': 'bytes',
	'file_date': 'last modified',

	'project_bits': 'bits',
	'project_channels': 'channels',
	'project_pixels': 'pixels',
	'project_folders': 'folders',
	'project_layers': 'layers',
	'project_images': 'images',

	'reset_header': 'Reset options',
	'reset_to_init': 'To initial',
	'reset_to_top': 'To top',
	'reset_to_bottom': 'To bottom',
	'reset_to_empty': 'To empty where possible',

	'current_header': 'Selected options',
	'show_png': 'Show',
	'save_png': 'Save',

	'batch_header': 'Selected batch',
	'batch_count_singular': '{0} variant',
	'batch_count_plural': '{0} variants',
	'show_png_batch': 'Show all',
	'save_png_batch': 'Save all',
	'show_png_collage': 'Show collage',
	'save_png_collage': 'Save collage',

	'option_header_collage': 'Collage',
	'option_header_view': 'View',
	'option_header_parts': 'Visible parts',
	'option_header_opacities': 'Transparent parts',
	'option_header_paddings': 'Outlines and paddings',
	'option_header_colors': 'Colors',

	'option_collage_align': 'align rows',
	'option_collage_background': 'background color',
	'option_collage_border': 'border around',
	'option_collage_padding': 'padding inbetween',

	'option_autocrop': 'autocrop around',
	'option_zoom': 'scale',
	'option_side': 'side',
	'option_separate': 'separate',

	'align_bottom': 'bottom',
	'align_bottomleft': 'bottom-left',
	'align_bottomright': 'bottom-right',
	'align_left': 'left',
	'align_right': 'right',
	'align_top': 'top',
	'align_topleft': 'top-left',
	'align_topright': 'top-right',

	'background_color': 'color',
	'background_transparent': '100% transparent',

	'autocrop_by_color': 'color',
	'autocrop_bottomleft': 'bottom-left color',
	'autocrop_bottomright': 'bottom-right color',
	'autocrop_topleft': 'top-left color',
	'autocrop_topright': 'top-right color',
	'autocrop_transparent': '100% transparent',

	'side_front': 'front',
	'side_back': 'back',

	'switch_all': 'all',
	'switch_single': 'single',
	'switch_inline': 'inline',
	'switch_newline': 'newline',

	'hint_switch_all': 'Use this whole list for batch view/save.',
	'hint_switch_single': 'Use only one selected option for batch view/save.',
	'hint_switch_inline': 'Keep images in collage for each options in this batch in one row.',
	'hint_switch_newline': 'Make a new row of images in collage for each option in this batch.',

	'hint_canvas': 'Right click to save result image.',
	'confirm_close_page': 'Close all projects on this the page?',
	'console_log': 'Show internal details',
	'see_console': 'See in the browser console.',
	'too_many': 'Too many',
	'too_much': 'Too much',

	'render_took_time': 'rendering this image took {0} sec.',
	'collage_took_time': 'joining {1} images took {0} sec.',

	'error_js_features': [
		'HTML5 Canvas or some other required JS features are not supported in your web browser program.',
		'Project rendering will not work, but you still can browse the links or download example files.',
	],
	'error_canvas_size': [
		'Cannot create a canvas of required size: {0}.',
		'Try selecting less images or splitting long rows.',
	],
	'error_file_protocol': [
		'Cannot load files from disk via page request, because of security concerns.',
		'Try using the "{0}" menu in the top of the page.',
	],
	'error_file': 'No suitable files found.',
	'error_project': 'Project composition error.',
	'error_options': 'Project without options.',

	'unknown_button': 'Unknown button.',
	'todo': 'TODO',

	'loading': 'Loading page...',
};
