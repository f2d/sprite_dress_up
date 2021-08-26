#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Python 2 or 3 should work.

import base64, datetime, io, json, math, os, re, subprocess, sys, time, zipfile

# Use colored text if available:
try:
	from termcolor import colored, cprint
	import colorama

	colorama.init()

except ImportError:
	def colored(*list_args, **keyword_args): return list_args[0]
	def cprint(*list_args, **keyword_args): print(list_args[0])

# Workaround for Python 2:
# https://stackoverflow.com/a/26745443
# https://github.com/pytorch/pytorch/issues/6932#issuecomment-388586780
try:
	FileNotFoundError
except NameError:
	FileNotFoundError = IOError

file_encoding = print_encoding = sys.getfilesystemencoding() or 'utf-8'



# - Config - source files and result content: -------------------------------



src_root_path = 'example_project_files'
dest_file_path = 'config.js'

src_dir_var_name = 'exampleRootDir'
filelist_var_name = 'exampleProjectFiles'

preview_size_var_name = 'PREVIEW_SIZE'
thumbnail_size_var_name = 'THUMBNAIL_SIZE'

preview_size = '80'
thumbnail_size = '20'

resize_filter = 'Welch'

quote = '"'

is_dest_array = True



# - Command line arguments: -------------------------------------------------



def get_arg_undashed(arg_name):
	return arg_name.replace('-', '').replace('_', '') or arg_name

def get_first_found_arg_in_cmd(arg_names):
	for arg_name in arg_names:
		undashed_arg = get_arg_undashed(arg_name)

		if undashed_arg in undashed_args:
			return undashed_arg
	return None

def get_cmd_arg_after_arg(first_arg_names, natural_number=False):
	first_arg_name = get_first_found_arg_in_cmd(first_arg_names)

	if first_arg_name:
		i = undashed_args.index(first_arg_name) + 1

		if len(undashed_args) > i:
			next_arg = sys.argv[i]

			if natural_number:
				try:
					if int(next_arg) < 1:
						return None
				except:
					return None
			return next_arg
	return None

undashed_args = list(map(get_arg_undashed, sys.argv))

TEST         = get_first_found_arg_in_cmd(['t', 'test'])
TEST_FILTERS = get_first_found_arg_in_cmd(['f', 'test_filters', 'filters'])

IM_6 = get_first_found_arg_in_cmd(['imagemagick6', 'im6', '6'])
IM_7 = get_first_found_arg_in_cmd(['imagemagick7', 'im7', '7'])
IM_UNDEFINED = not (IM_6 or IM_7)

USE_OPTIPNG = get_first_found_arg_in_cmd(['o', 'optipng'])
USE_LEANIFY = get_first_found_arg_in_cmd(['l', 'leanify'])

arg_src_root_path  = get_cmd_arg_after_arg(['src', 'src_path', 'src_root_path'])
arg_dest_file_path = get_cmd_arg_after_arg(['dest', 'dest_path', 'dest_file_path'])
arg_resize_filter  = get_cmd_arg_after_arg(['r', 'filter', 'thumb_filter', 'thumbnail_filter', 'resize_filter'])
arg_thumbnail_size = get_cmd_arg_after_arg(['s', 'size', 'thumb_size', 'thumbnail_size'], natural_number=True)
arg_preview_size   = get_cmd_arg_after_arg(['z', 'zoom_size', 'preview_size'], natural_number=True)



# - Config - external helper programs: --------------------------------------



# Full path example: 'd:/programs/ImageMagick_7/magick.exe'
# Directory part of this path will be used for version 6 commands, if present.

converter_exe_path = 'magick'

converter_filters = []				# <- get automatically once for each run

merged_layer_suffix = '[0]'			# <- to use pre-merged layer

temp_extracted_file_path = 'temp_extracted.png'
temp_resized_file_path = 'temp_resized.png'

src_file_path_placeholder = '<src_placeholder>'
new_size_placeholder = '<size_placeholder>'
filter_placeholder = '<filter_placeholder>'

layer_suffix_file_types = [
	'psd'
,	'psb'
]

zip_file_types = [
	'ora'
,	'kra'
]

zipped_thumbnail_filenames = [
	'preview.png'
,	'thumbnail.png'
,	'mergedimage.png'
]

zipped_fullsize_filenames = [
	'mergedimage.png'
]

cmd_args_to_get_image_size = [
	'identify'
,	'-verbose'
,	'-format'
,	'%Wx%H'
,	src_file_path_placeholder
]

cmd_args_to_make_resized_image = [
	'convert'
,	src_file_path_placeholder
,	'-verbose'
,	'-filter'
,	filter_placeholder
,	'-thumbnail'
,	new_size_placeholder
,	'png32:' + temp_resized_file_path
]

cmd_args_to_get_filters = [
	'convert'
,	'-list'
,	'filter'
]

cmd_args_to_optimize_image_with_optipng = [
	'optipng'
,	'-i'
,	'0'
,	'-fix'
,	src_file_path_placeholder
]

cmd_args_to_optimize_image_with_leanify = [
	'leanify'
,	'-v'
,	src_file_path_placeholder
]

pat_check_image_size = re.compile(r'^(\d+)x(\d+)$', re.U | re.I)



# - Config - internal, do not change: ---------------------------------------



pat_comment_line = re.compile(r'((?:^|[\r\n])\s*)(//([^\r\n]*))', re.U | re.S)
pat_comment_block = re.compile(r'((?:^|[\r\n])\s*)(/\*(.*?)\*/)', re.U | re.S)
pat_trailing_space = re.compile(r'[^\S\r\n]+(?=$|[\r\n])', re.U)
pat_unslash = re.compile(r'\\(.)', re.U | re.S)

format_epoch = '%Epoch'	# <- not from python library, but custom str-replaced
# format_ymd = '%Y-%m-%d'
# format_hms = '%H-%M-%S'
format_print = '%Y-%m-%d %H:%M:%S'
must_quote_chars = ' ,;>='
horizontal_separator_line_text = '--------        --------        --------        --------'

s_type = type('')
u_type = type(u'')

converter_exe_path_dir = os.path.dirname(converter_exe_path)



# - Functions: --------------------------------------------------------------



def print_tabs(*tabs):
	print('\t'.join(tabs))

def print_with_colored_title(title=None, content=None, title_color=None, content_color=None):
	print('')

	if not title_color:
		if title.find('Error') >= 0:
			title_color = 'red'

		elif title.find('Completed') >= 0:
			title_color = 'green'

		elif title.find('Running') >= 0:
			title_color = 'magenta'

		elif (
			title.find('Done') >= 0
		or	title.find('Result') >= 0
		or	title.find(horizontal_separator_line_text) >= 0
		):
			title_color = 'cyan'

		else:
			title_color = 'yellow'

	if title is not None:
		if title_color:
			cprint(title, title_color)
		else:
			print(title)

	if content is not None:
		if content_color:
			cprint(content, content_color)
		else:
			print(content)

def is_type_str(v):
	return isinstance(v, (s_type, u_type))

def get_str_from_bytes(v):
	return v if is_type_str(v) else v.decode()

def get_text_encoded_for_print(text):
	return text.encode(print_encoding) if sys.version_info.major == 2 else text

def is_any_char_of_a_in_b(chars, text):
	for char in chars:
		if text.find(char) >= 0:
			return True

	return False

def is_any_char_code_out_of_normal_range(text):
	for char in text:
		if ord(char) > 127:
			return True

	return False

def is_quoted(text):
	for char in '\'"':
		if text[0] == char and text[-1 : ][0] == char:
			return True

	return False

def quoted_if_must(text):
	text = get_text_encoded_for_print(text)

	return (
		'"{}"'.format(text)
		if not is_quoted(text) and (
			is_any_char_of_a_in_b(must_quote_chars, text)
		or	is_any_char_code_out_of_normal_range(text)
		)
		else text
	)

def quoted_list(args):
	return list(map(quoted_if_must, args))

def cmd_args_to_text(args):
	return ' '.join(quoted_list(args))

def timestamp(str_format=format_print):
	return time.strftime(format_print)

def timestamp_now(str_format=format_epoch):
	return time.strftime(str_format.replace(format_epoch, str(int(time.time()))))

def get_formatted_time(t, str_format=format_print):
	return datetime.datetime.fromtimestamp(t).strftime(str_format)

# https://gist.github.com/cbwar/d2dfbc19b140bd599daccbe0fe925597#gistcomment-2845059
def get_formatted_filesize(num, space=' ', binary='i', suffix='B'):
	magnitude = int(math.floor(math.log(num, 1024)))
	val = num / math.pow(1024, magnitude)
	if magnitude > 7:
		return '{:.1f}{}{}{}{}'.format(val, space, 'Y', binary, suffix)
	return '{:3.1f}{}{}{}{}'.format(val, space, ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z'][magnitude], binary, suffix)

def get_quoted_value_text(value):
	return (
		quote
	+	(
			str(value)
			.replace('\\', '\\\\')
			.replace(quote, '\\' + quote)
		)
	+	quote
	)

def remove_comments(text):
	text = re.sub(pat_comment_line, r'\1', text)
	text = re.sub(pat_comment_block, r'\1', text)

	return text

def normalize_slashes(path):
	return path.replace('\\', '/')

def get_file_name(path):
	return normalize_slashes(path).rsplit('/', 1)[-1:][0]

def get_file_ext(path):
	return get_file_name(path).rsplit('.', 1)[-1:][0]

def read_file(path, mode='r'):
	if not os.path.isfile(path):
		return ''

	if 'b' not in mode:
		file = io.open(path, mode, encoding=file_encoding)
	else:
		file = open(path, mode)

	result = file.read()
	file.close()

	return result

def write_file(path, content, mode='a'):
	result = None

	if 'b' not in mode and isinstance(content, u_type):
		file = io.open(path, mode, encoding=file_encoding)
	else:
		file = open(path, mode)

	try:
		result = file.write(content)

	except Exception as exception:
		print_with_colored_title('Error writing file:', exception)

		# result = file.write(exception)	# <- why? I don't remember

	file.close()

	return result

def rewrite_file(path, content, mode='w'):
	return write_file(path, content, mode)

def remove_temp_file(path=None):
	if path:
		if os.path.isfile(path):
			print_with_colored_title('Removing temporary file:', path)

			os.remove(path)
	else:
		remove_temp_file(temp_extracted_file_path)
		remove_temp_file(temp_resized_file_path)

	return path

def get_separate_lists_of_files_and_dirs(root_path):
	files = []
	dirs = []

	for name in os.listdir(root_path):
		path = root_path + '/' + name

		if os.path.isfile(path): files.append(name)
		elif os.path.isdir(path): dirs.append(name)

	return (
		sorted(files)
	,	sorted(dirs)
	)

def get_old_field(old_files, dir_name, filename, field_name):
	try:
		for old_dir in old_files:
			if old_dir.get('subdir', '') == dir_name:
				for old_file in old_dir.get('files', []):
					if old_file.get('name', '') == filename:
						return old_file.get(field_name, '')
	except:
		pass
	return ''

def get_image_cmd_versions(cmd_args):
	cmd_versions = []

	if IM_7 or IM_UNDEFINED:
		cmd_versions.append(
			[converter_exe_path]
		+	cmd_args
		)

	if IM_6 or IM_UNDEFINED:
		cmd_versions.append(
			[converter_exe_path_dir + cmd_args[0]]
		+	cmd_args[1:]
		)

	return cmd_versions

def get_image_path_for_cmd(src_file_path, check_thumbnail=False):
	print_with_colored_title('Parsing image file:', src_file_path)

	src_file_ext = get_file_ext(src_file_path)
	print_with_colored_title('File type:', src_file_ext)

	if src_file_ext in zip_file_types:

		src_zip = zipfile.ZipFile(src_file_path, 'r')
		if src_zip:
			names_to_search = (
				zipped_thumbnail_filenames
				if check_thumbnail
				else zipped_fullsize_filenames
			)

			for zipped_path in src_zip.namelist():
				name = get_file_name(zipped_path)

				if name in names_to_search:
					print_with_colored_title('Found full merged image file:', zipped_path)

					unzipped_content = src_zip.read(zipped_path)

					src_file_path = remove_temp_file(temp_extracted_file_path)
					src_file_ext = get_file_ext(src_file_path)

					write_file(src_file_path, unzipped_content, mode='w+b')

					break

	if src_file_ext in layer_suffix_file_types:
		src_file_path += merged_layer_suffix

	return src_file_path

def get_cmd_result(cmd_args):
	print_with_colored_title('Running command:', cmd_args_to_text(cmd_args))

	# https://stackoverflow.com/a/16198668
	try:
		# Note: IM does not work in Linux terminal with shell=True.
		# Note: stderr without override could be shown before the next print.

		output = subprocess.check_output(cmd_args, stderr=subprocess.STDOUT)

	except subprocess.CalledProcessError as exception:
		print_with_colored_title(
			'Error code {}, command output:'.format(exception.returncode)
		,	get_str_from_bytes(exception.output)
		)

	except (FileNotFoundError, IOError, OSError) as exception:
		print_with_colored_title('Error:', exception)

	else:
		output = get_str_from_bytes(output)

		print_with_colored_title('Done, command output:', output)

		return output

	return ''

def get_converter_filters():
	if not len(converter_filters):

		for cmd_args in get_image_cmd_versions(cmd_args_to_get_filters):
			cmd_result = get_cmd_result(cmd_args)

			if cmd_result:
				a = cmd_result.split('\n')
				a = [line.strip() for line in a]
				a = filter(None, a)
				a = sorted(list(set(a)))

				converter_filters.extend(a)

				break

	return converter_filters

def get_image_cmd_result(src_file_path, cmd_args, new_size_arg=None, check_thumbnail=False):
	if not new_size_arg:
		new_size_arg = thumbnail_size_arg

	src_file_name = get_file_name(src_file_path)
	src_file_path = get_image_path_for_cmd(src_file_path, check_thumbnail=False)

	# must get list instead of map object, or it will not run in python3:
	cmd_args_with_src_path = [
		(
			resize_filter if (not TEST_FILTERS) and (arg == filter_placeholder)
			else new_size_arg if (arg == new_size_placeholder)
			else src_file_path if (arg == src_file_path_placeholder)
			else arg
		) for arg in cmd_args
	]

	if filter_placeholder in cmd_args_with_src_path:
		if not os.path.isdir(new_size_arg):
			os.makedirs(new_size_arg)

		for filter_name in get_converter_filters():
			cmd_args_with_filter = [
				(
					filter_name if (arg == filter_placeholder)
					else arg if (arg.find(temp_resized_file_path) < 0)
					else (
						'_' + src_file_name +
						'_' + new_size_arg +
						'_' + filter_name +
						'.'
					).join(
						(
							(new_size_arg + '/' + arg) if (arg.find(':') < 0)
							else (
								':' + new_size_arg + '/'
							).join(
								arg.split(':', 1)
							)
						).rsplit('.', 1)
					)
				) for arg in cmd_args_with_src_path
			]

			get_cmd_result(cmd_args_with_filter)

		i = cmd_args_with_src_path.index(filter_placeholder)
		cmd_args_with_src_path = cmd_args_with_src_path[: i - 2] + cmd_args_with_src_path[i + 1 :]

	return get_cmd_result(cmd_args_with_src_path)

def get_image_size(src_file_path):
	for try_cmd_args_to_get_image_size in get_image_cmd_versions(cmd_args_to_get_image_size):

		cmd_result = get_image_cmd_result(
			src_file_path
		,	try_cmd_args_to_get_image_size
		)

		image_size = cmd_result.strip().lower()

		if re.match(pat_check_image_size, image_size):
			print_with_colored_title('Got image size:', image_size)

			return image_size

	return ''

def get_resized_image_as_base64(src_file_path, new_size_arg=None):
	if not new_size_arg:
		new_size_arg = thumbnail_size_arg

	for try_cmd_args_to_resize_image in get_image_cmd_versions(cmd_args_to_make_resized_image):

		temp_file_path = remove_temp_file(temp_resized_file_path)

		cmd_result = get_image_cmd_result(
			src_file_path
		,	try_cmd_args_to_resize_image
		,	new_size_arg=new_size_arg
		,	check_thumbnail=True
		)

		if os.path.isfile(temp_file_path):
			optimizer_commands = []

			if USE_OPTIPNG:
				optimizer_commands.append(cmd_args_to_optimize_image_with_optipng)

			if USE_LEANIFY:
				optimizer_commands.append(cmd_args_to_optimize_image_with_leanify)

			for try_cmd_args_to_optimize_image in optimizer_commands:
				cmd_result = get_cmd_result(
					[
						(
							temp_file_path
							if arg == src_file_path_placeholder
							else arg
						) for arg in try_cmd_args_to_optimize_image
					]
					if src_file_path_placeholder in try_cmd_args_to_optimize_image
					else (try_cmd_args_to_optimize_image + [temp_file_path])
				)

			raw_content = read_file(temp_file_path, mode='r+b')

			base64_content = (
				'data:image/'
			+	get_file_ext(temp_file_path).replace('jpg', 'jpeg')
			+	';base64,'
			+	base64.b64encode(raw_content).decode()
			)

			print_with_colored_title('Got resized image content:', '{} bytes'.format(len(base64_content)))

			return base64_content

	return ''



# - Check old list content: -------------------------------------------------



if arg_dest_file_path:
	dest_file_path = arg_dest_file_path

print_with_colored_title('Reading old file:', dest_file_path)

t = timestamp()
mark_before = '// * generated file list start, saved at ' + t
mark_after = '// * generated file list end, saved at ' + t

content_before = content_after = ''

old_files = None
old_content = read_file(dest_file_path)

if old_content:
	print('{} bytes'.format(len(old_content)))

	pat_array_value = re.compile(
		r'''^
			(?P<Before>.*?\b''' + filelist_var_name + r'''\b\s*=\s*)
			(?P<OldFileList>[\[\{].*?[\]\}])
			(?P<After>;[\r\n]+.*)
		$'''
	,	re.I | re.S | re.U | re.X
	)

	pat_var_value = re.compile(
		r'''
			(?P<Comment>
				(?P<CommentLine>(^|[\r\n])\s*//[^\r\n]*)
			|	(?P<CommentBlock>/[*].*?[*]/)
			)
		|	(?P<Declaration>\b(var|let|const|,)\s+)
			(?P<VarName>[^\s'"`~!@#$%^&*{}()\[\].,;+=-]+)
			(?P<Operator>\s*=\s*)
			(?P<VarValue>
				[+-]?(?P<Numeric>\d+)
			|	'(?P<Quoted1>([\\\\]'|[^'])*)'
			|	"(?P<Quoted2>([\\\\]"|[^"])*)"
			)
		'''
	,	re.I | re.S | re.U | re.X
	)

	match = re.search(pat_array_value, old_content)
	if match:
		content_before = match.group('Before')
		content_after = match.group('After')

		old_vars_text = remove_comments(content_before + content_after)
		old_files_text = remove_comments(match.group('OldFileList'))

		print_with_colored_title('Parsing old file list:', '{} bytes'.format(len(old_files_text)))

		try:
			old_files = json.loads(old_files_text)	# <- 'encoding' is ignored and deprecated.

			print_with_colored_title('Done parsing old file list:')

		except Exception as exception:
			old_files = []

			print_with_colored_title('Error parsing old file list JSON:', exception)

		for group in old_files:
			files = group.get('files')

			if files:
				subdir = group.get('subdir', '')

				if subdir:
					subdir += '/'

				for file in files:
					print_tabs(
						subdir +
						file.get('name',     colored('<no name>', 'red'))
					,	file.get('pixels',   colored('<no WxH>',  'red'))
					,	file.get('filesize', colored('<no size>', 'red'))
					,	file.get('modtime',  colored('<no time>', 'red'))
					)

		print_with_colored_title('Parsing optional old variables:')

		for match in re.finditer(pat_var_value, old_vars_text):
			if match.group('Comment'):
				continue

			var_value = (
				match.group('Numeric')
			or	match.group('Quoted1')
			or	match.group('Quoted2')
			)

			if len(var_value) > 0:
				var_name = match.group('VarName')

				if var_name == src_dir_var_name:
					src_root_path = re.sub(pat_unslash, r'\1', var_value)

				elif var_name == preview_size_var_name:
					try:
						if int(var_value) > 0:
							preview_size = var_value
					except:
						continue

				elif var_name == thumbnail_size_var_name:
					try:
						if int(var_value) > 0:
							thumbnail_size = var_value
					except:
						continue

				else:
					continue

				print('{0} = {1}'.format(var_name, var_value))

		print_with_colored_title('Done parsing old variables.')
else:
	print('Empty or none.')



# - Override old values with command-line arguments: ------------------------



if arg_src_root_path:  src_root_path  = arg_src_root_path
if arg_resize_filter:  resize_filter  = arg_resize_filter
if arg_preview_size:   preview_size   = arg_preview_size
if arg_thumbnail_size: thumbnail_size = arg_thumbnail_size

preview_size_arg   = '{0}x{0}'.format(preview_size)
thumbnail_size_arg = '{0}x{0}'.format(thumbnail_size)



# - Get list of files: ------------------------------------------------------



print_with_colored_title('Searching files in:', src_root_path)

src_filenames_by_subdir = {}

files, dirs = get_separate_lists_of_files_and_dirs(src_root_path)

if files:
	src_filenames_by_subdir[''] = files

if dirs:
	for name in dirs:
		files, dirs2 = get_separate_lists_of_files_and_dirs(src_root_path + '/' + name)
		src_filenames_by_subdir[name] = files

print_with_colored_title('Found files:')

for dir_name, filenames in sorted(src_filenames_by_subdir.items()):
	for filename in sorted(filenames):
		print(src_root_path + '/' + dir_name + '/' + filename)



# - Get metadata of files: --------------------------------------------------



# https://stackoverflow.com/a/49868510
pat_separate_thousands = re.compile(r'(?<!^)(?=(\d{3})+$)')

new_files = [] if is_dest_array else {}



for dir_name, filenames in sorted(src_filenames_by_subdir.items()):
	files = []
	for filename in sorted(filenames):
		path = src_root_path + '/' + dir_name + '/' + filename

		num_filesize = os.path.getsize(path)
		num_modtime = os.path.getmtime(path)

		text_filesize_short = get_formatted_filesize(num_filesize, space=' ', binary='', suffix='')
		text_filesize_bytes = re.sub(pat_separate_thousands, r' ', str(num_filesize))
		text_modtime = get_formatted_time(num_modtime)

		text_image_size = (
			get_image_size(path)
		or	get_old_field(old_files, dir_name, filename, 'pixels')
		)

		text_preview_base64 = (
			get_resized_image_as_base64(path, preview_size_arg)
		or	get_old_field(old_files, dir_name, filename, 'preview')
		)

		text_thumbnail_base64 = (
			get_resized_image_as_base64(path, thumbnail_size_arg)
		or	get_old_field(old_files, dir_name, filename, 'thumbnail')
		)

		files.append(
			{
				'name':		filename
			,	'pixels':	text_image_size
			,	'filesize':	text_filesize_short
			,	'bytes':	text_filesize_bytes
			,	'modtime':	text_modtime
			,	'preview':	text_preview_base64
			,	'thumbnail':	text_thumbnail_base64
			}
		)

	if is_dest_array:
		new_files.append(
			{
				'subdir': dir_name
			,	'files':  files
			}
		)
	else:
		new_files[dir_name] = files



# - Compile results: --------------------------------------------------------



try:
	json_text = json.dumps(new_files, sort_keys=True, indent='\t', default=repr)	# <- use tabs, only in python 3
except TypeError:
	json_text = json.dumps(new_files, sort_keys=True, indent=4, default=repr)	# <- use spaces, fallback for python 2

json_lines = (
	re.sub(
		pat_trailing_space
	,	''
	,	json_text
	)
	.replace(' '*4, '\t')	# <- use tabs anyway
	.split('\n')
)



if old_content:
	replacements = [
		{
			'var_name': src_dir_var_name
		,	'new_value': get_quoted_value_text(src_root_path)
		,	'encounters': 0
		}
	,	{
			'var_name': preview_size_var_name
		,	'new_value': preview_size
		,	'encounters': 0
		}
	,	{
			'var_name': thumbnail_size_var_name
		,	'new_value': thumbnail_size
		,	'encounters': 0
		}
	]

	def replace_var(match):
		if match.group('Comment'):
			return match.group(0)

		var_name = match.group('VarName')

		for replacement in replacements:
			if var_name == replacement['var_name']:
				replacement['encounters'] += 1

				return ''.join([
					match.group('Declaration')
				,	var_name
				,	match.group('Operator')
				,	replacement['new_value']
				])

		return match.group(0)

	content_before = re.sub(pat_var_value, replace_var, content_before)
	content_after = re.sub(pat_var_value, replace_var, content_after)

	for replacement in replacements:
		if not replacement['encounters']:
			content_before = '\nvar {} = {};\n{}'.format(
				replacement['var_name']
			,	replacement['new_value']
			,	content_before
			)

else:
	content_before = '\n\n'.join([
		'\n'.join([
			''
		,	'// * Remove slashes before the variables to override default values.'
		,	'// * See more available settings in the main script file (index.js).'
		,	'// * Add any overrides only here, to this file.'
		,	'// * Notes to avoid generation trouble:'
		,	'// *	Keep paths as simple one-line strings.'
		,	'// *	Keep JSON as strictly simple and valid.'
		])
	,	'// var TESTING = true;'
	,	'// var EXAMPLE_NOTICE = false;'
	,	'var {} = {};'.format(preview_size_var_name, preview_size)
	,	'var {} = {};'.format(thumbnail_size_var_name, thumbnail_size)
	,	'var {} = {};'.format(src_dir_var_name, get_quoted_value_text(src_root_path))
	,	'var {} ='.format(filelist_var_name)
	])

	content_after = ';'



new_content = '\n'.join([
	content_before.rstrip() + ' ' + json_lines[0]
,	mark_before
,	'\n'.join(json_lines[1:-1])
,	mark_after
,	json_lines[-1] + content_after.strip() + '\n'
])



# - Output results: ---------------------------------------------------------



if TEST:
	print_with_colored_title('Result output for testing, not saved:')
else:
	print_with_colored_title('Result output for saving:')

print_with_colored_title(horizontal_separator_line_text)
print(new_content)
print_with_colored_title(horizontal_separator_line_text)

if TEST:
	print_with_colored_title('Completed test run.')
else:
	remove_temp_file()

	print_with_colored_title('Saving to file:', dest_file_path)
	rewrite_file(dest_file_path, new_content)

	print_with_colored_title('Completed saving new config.')
