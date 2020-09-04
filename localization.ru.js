
function getLocalizedCaseByCount(num) {
const	absValue = Math.abs(num)
,	numPartUnder100 = absValue % 100
,	numPartUnder10 = absValue % 10
,	numPartFraction = absValue % 1
	;

	if (
		(numPartUnder100 > 10 && numPartUnder100 < 20)
	||	(numPartFraction > 0)
	) {
		return 'plural';
	}

	if (numPartUnder10 > 1 && numPartUnder10 < 5) {
		return 'genitive';
	}

	if (numPartUnder10 !== 1) {
		return 'plural';
	}

	return 'singular';
}

const LOCALIZATION_TEXT = {
	'file': 'Файл',
	'file_select_project': 'Перетащите и сбросьте файл проекта на эту страницу, или выберите здесь',
	'file_formats': 'Возможные типы файлов',
	'file_notes': [
		'Примечания:',
		'ZIP-файлы открываются так же, как ORA, если содержание подходит.',
		'Если открыть файлы с одинаковым именем, более ранние закроются.',
	],

	'examples': 'Примеры',
	'examples_notice': [
		'Примечание:',
		'Файлы тут представлены только как образцы для изучения.',
		'Не используйте их где-либо ещё без разрешения.',
	],

	'psd_from_sai2': 'SAI2 → PSD прямо как есть',
	'ora_mockup': 'SAI2 → PSD → Krita (нет клиппинга) → ORA (нет масок) → ручная правка',
	'from_paint.net': 'paint.net (с доп.модулями) → PSD и ORA прямо как есть (нет папок)',

	'about': 'О проекте',
	'about_source': 'Исходный код, обсуждения проблем и доработки',
	'about_lang': 'Эта страница на разных языках',
	'about_notes': [
		'Примечания:',
		'Для этой страницы рекомендуются Chrome-подобные браузеры.',,
		'Например, Firefox хранит цвета в канве умноженными на прозрачность для ускорения показа,',
		'но от этого в операциях смешивания теряется точность и на градиентах, которые должны быть плавными, появляются полосы.',,
		'Позже планируется добавить отображение с высокой точностью независимо от встроенных алгоритмов браузера.',
	],

	'help': 'Справка',

	'save_all_projects': 'Сохранить все открытые проекты',
	'save_all_ora': 'Сохранить в ORA',
	'save_all_png': 'Сохранить в PNG',
	'save_all_png_batch': 'Сохранить все варианты в PNG',

	'close_all_projects': 'Закрыть все открытые проекты',
	'close_all_with_no_var': 'Только без вариантов',
	'close_all_with_errors': 'Только с ошибками',
	'close_all': 'Закрыть все',

	'download_file': 'Сохранить файл',
	'download_all': 'Сохранить все',
	'open_example_file': 'Показать пример',
	'open_example_all': 'Показать все',
	'stop': 'Остановить (Esc)',

	'open_same_name': 'Если открыть файл с тем же именем, что уже есть в открытых',
	'ask': 'Спросить',
	'skip': 'Пропустить',
	'replace': 'Заменить',
	'replace_old': 'Заменить более старые',

	'file_bytes': 'байт',
	'file_date': 'дата сохранения',

	'project_bits': 'бит',
	'project_channels': 'каналов',
	'project_pixels': 'точек',
	'project_folders': 'папок',
	'project_layers': 'слоёв',
	'project_images': 'картинок',

	'reset_header': 'Сбросить сочетание',
	'reset_to_init': 'На начальные',
	'reset_to_top': 'На верхние',
	'reset_to_bottom': 'На нижние',
	'reset_to_empty': 'На пустые, где возможно',

	'current_header': 'Выбранное сочетание',
	'show_png': 'Показать',
	'save_png': 'Сохранить',

	'batch_header': 'Выбранное множество',
	'batch_count_singular': '{0} вариант',
	'batch_count_genitive': '{0} варианта',
	'batch_count_plural': '{0} вариантов',
	'show_png_batch': 'Показать все',
	'save_png_batch': 'Сохранить все',
	'show_png_collage': 'Показать коллаж',
	'save_png_collage': 'Сохранить коллаж',

	'option_header_collage': 'Коллаж',
	'option_header_view': 'Вид',
	'option_header_parts': 'Видимые детали',
	'option_header_opacities': 'Прозрачные детали',
	'option_header_paddings': 'Поля и обводка',
	'option_header_colors': 'Цвета',

	'option_collage_align': 'равнение рядов',
	'option_collage_background': 'цвет фона',
	'option_collage_border': 'поля вокруг',
	'option_collage_padding': 'поля промеж',

	'option_autocrop': 'срезать края',
	'option_zoom': 'масштаб',
	'option_side': 'сторона',
	'option_separate': 'раздельно',

	'align_bottom': 'вниз',
	'align_bottomleft': 'вниз-влево',
	'align_bottomright': 'вниз-вправо',
	'align_left': 'влево',
	'align_right': 'вправо',
	'align_top': 'вверх',
	'align_topleft': 'вверх-влево',
	'align_topright': 'вверх-вправо',

	'background_color': 'цвет',
	'background_transparent': '100% прозрачный',

	'autocrop_by_color': 'цвет',
	'autocrop_bottomleft': 'цвет снизу-слева',
	'autocrop_bottomright': 'цвет снизу-справа',
	'autocrop_topleft': 'цвет сверху-слева',
	'autocrop_topright': 'цвет сверху-справа',
	'autocrop_transparent': '100% прозрачные',

	'side_front': 'спереди',
	'side_back': 'сзади',

	'switch_all': 'все',
	'switch_single': 'один',
	'switch_inline': 'подряд',
	'switch_newline': 'раздел',

	'hint_switch_all': 'Использовать весь этот список для показа/сохранения сразу множества вариантов.',
	'hint_switch_single': 'Использовать только выбранную тут строку для показа/сохранения сразу множества вариантов.',
	'hint_switch_inline': 'Оставить варианты этого списка в одном ряду.',
	'hint_switch_newline': 'Отдельный ряд в коллаже для каждого варианта из этого списка.',

	'hint_canvas': 'Кликните правой кнопкой, чтобы сохранить результат.',
	'confirm_close_page': 'Закрыть все проекты на этой странице?',
	'console_log': 'Показать внутренние подробности',
	'see_console': 'Смотрите в консоли браузера.',
	'too_many': 'Слишком много',
	'too_much': 'Слишком много',

	'render_took_time': 'на отрисовку этой картинки ушло {0} сек.',
	'collage_took_time': 'на соединение {1} картинок ушло {0} сек.',

	'error_js_features': [
		'HTML5-полотно или другие необходимые JS не поддерживается в вашей программе для просмотра интернета.',
		'Отображение проектов не будет работать, но всё ещё можно смотреть ссылки и скачивать файлы примеров.',
	],
	'error_canvas_size': [
		'Нет возможности создать полотно необходимого размера: {0}.',
		'Выберите меньше картинок или разделите длинные ряды.',
	],
	'error_file_protocol': [
		'Нет возможности открыть файл с диска запросом от страницы, из соображений безопасности.',
		'Используйте меню "{0}" наверху страницы.',
	],
	'error_file': 'Не найдено подходящих файлов.',
	'error_project': 'Ошибка в структуре проекта.',
	'error_options': 'Проект не содержит вариантов.',

	'unknown_button': 'Неизвестная кнопка.',
	'todo': 'НЕДОДЕЛАНО',

	'loading': 'Загрузка страницы...',
};
