#!/usr/bin/env python
# -*- coding: UTF-8 -*-

# Python 2 or 3 should work.

import base64, datetime, json, math, os, re, subprocess, sys, time, zipfile



# - config - source files and result content: -------------------------------



src_root_path = 'example_project_files'
dest_file_path = 'config.js'

src_dir_var_name = 'exampleRootDir'
filelist_var_name = 'exampleProjectFiles'
thumbnail_size_var_name = 'THUMBNAIL_SIZE'

quote = '"'

is_dest_array = True

thumbnail_size = '20'
thumbnail_filter = 'Welch'



# - command line arguments: -------------------------------------------------



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

arg_src_root_path    = get_cmd_arg_after_arg(['src', 'src_path', 'src_root_path'])
arg_dest_file_path   = get_cmd_arg_after_arg(['dest', 'dest_path', 'dest_file_path'])
arg_thumbnail_filter = get_cmd_arg_after_arg(['filter', 'thumb_filter', 'thumbnail_filter'])
arg_thumbnail_size   = get_cmd_arg_after_arg(['size', 'thumb_size', 'thumbnail_size'], natural_number=True)



# - config - external helper programs: --------------------------------------


# Full path example: 'd:/programs/ImageMagick_7/magick.exe'
# Directory part of this path will be used for version 6 commands, if present.

converter_exe_path = 'magick'

converter_filters = None			# <- get automatically once for each run

merged_layer_suffix = '[0]'			# <- to use pre-merged layer
temp_layer_file_path = 'temp_layer.png'
temp_thumb_file_path = 'temp_thumb.png'
src_file_path_placeholder = '<src_placeholder>'
thumbnail_size_placeholder = '<size_placeholder>'
filter_placeholder = '<filter_placeholder>'

layer_suffix_file_types = [
	'psd'
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

cmd_get_image_size_args = [
	'identify'
,	'-verbose'
,	'-format'
,	'%Wx%H'
,	src_file_path_placeholder
]

cmd_make_thumbnail_args = [
	'convert'
,	src_file_path_placeholder
,	'-verbose'
,	'-filter'
,	filter_placeholder
,	'-thumbnail'
,	thumbnail_size_placeholder
,	'png32:' + temp_thumb_file_path
]

cmd_get_filters = [
	'convert'
,	'-list'
,	'filter'
]

pat_check_image_size = re.compile(r'^(\d+)x(\d+)$', re.U | re.I)



# - config - internal, do not change: ---------------------------------------



pat_comment_line = re.compile(r'((?:^|[\r\n])\s*)(//([^\r\n]*))', re.U | re.S)
pat_comment_block = re.compile(r'((?:^|[\r\n])\s*)(/\*(.*?)\*/)', re.U | re.S)
pat_unslash = re.compile(r'\\(.)', re.U | re.S)

format_epoch = '%Epoch'	# <- not from python library, but custom str-replaced
# format_ymd = '%Y-%m-%d'
# format_hms = '%H-%M-%S'
format_print = '%Y-%m-%d %H:%M:%S'
must_quote = ' ,;>='

s_type = type('')
u_type = type(u'')

converter_exe_path_dir = os.path.dirname(converter_exe_path)



# - functions: --------------------------------------------------------------



def is_type_str(v): return isinstance(v, s_type) or isinstance(v, u_type)
def get_str_from_bytes(v): return v if is_type_str(v) else v.decode()

def is_any_char_of_a_in_b(a, b):
	for c in a:
		if b.find(c) >= 0:
			return True

	return False

def quoted_if_must(text):
	return ('"' + text + '"') if is_any_char_of_a_in_b(must_quote, text) else text

def quoted_list(a):
	return map(quoted_if_must, a)

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

	f = open(path, mode)
	r = f.read()
	f.close()

	return r

def write_file(path, content, mode='a+b'):
	r = None
	f = open(path, mode)
	try:
		r = f.write(content)
	except Exception as e:
		r = f.write(e)
	f.close()

	return r

def rewrite_file(path, content, mode='w'):
	return write_file(path, content, mode)

def remove_temp_file(path=None):
	if path:
		if os.path.isfile(path):
			print('')
			print('Removing temporary file:')
			print(path)

			os.remove(path)
	else:
		remove_temp_file(temp_layer_file_path)
		remove_temp_file(temp_thumb_file_path)

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
	print('')
	print('Parsing image file:')
	print(src_file_path)

	src_file_ext = get_file_ext(src_file_path)

	print('')
	print('File type:')
	print(src_file_ext)

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
					print('')
					print('Found full merged image file:')
					print(zipped_path)

					unzipped_content = src_zip.read(zipped_path)

					src_file_path = remove_temp_file(temp_layer_file_path)
					src_file_ext = get_file_ext(src_file_path)

					write_file(src_file_path, unzipped_content)

					break

	if src_file_ext in layer_suffix_file_types:
		src_file_path += merged_layer_suffix

	return src_file_path

def get_cmd_result(cmd_args):
	print('')
	print('Running command:')
	print(' '.join(quoted_list(cmd_args)))

	# https://stackoverflow.com/a/16198668
	try:
		# Note: IM does not work in Linux terminal with shell=True
		output = subprocess.check_output(cmd_args)

	except subprocess.CalledProcessError as e:
		print('')
		print('Error code {}, command output:'.format(e.returncode))
		print(get_str_from_bytes(e.output))

	except FileNotFoundError as e:
		print('')
		print('Error:')
		print(e)

	else:
		output = get_str_from_bytes(output)

		print('')
		print('Done, command output:')
		print(output)

		return output

	return ''

def get_converter_filters():
	global converter_filters

	if not converter_filters:
		for cmd_args in get_image_cmd_versions(cmd_get_filters):
			cmd_result = get_cmd_result(cmd_args)

			if cmd_result:
				a = cmd_result.split('\n')
				a = map(lambda x: x.strip(), a)
				a = filter(None, a)
				a = sorted(list(set(a)))
				converter_filters = a

				break

	return converter_filters

def get_image_cmd_result(src_file_path, cmd_args, check_thumbnail=False):
	src_file_name = get_file_name(src_file_path)
	src_file_path = get_image_path_for_cmd(src_file_path, check_thumbnail=False)

	# must get list instead of map object, or it will not run in python3:
	cmd_args_with_src_path = list(map(
		lambda x: (
			thumbnail_filter if (not TEST_FILTERS) and (x == filter_placeholder)
			else thumbnail_size_arg if (x == thumbnail_size_placeholder)
			else src_file_path if (x == src_file_path_placeholder)
			else x
		)
	,	cmd_args
	))

	if filter_placeholder in cmd_args_with_src_path:
		for filter_name in get_converter_filters():
			cmd_args_with_filter = list(map(
				lambda x: (
					filter_name if (x == filter_placeholder)
					else x if x.find(temp_thumb_file_path) < 0
					else (
						'_' + src_file_name +
						'_' + filter_name +
						'.'
					).join(
						x.rsplit('.', 1)
					)
				)
			,	cmd_args_with_src_path
			))

			get_cmd_result(cmd_args_with_filter)

		i = cmd_args_with_src_path.index(filter_placeholder)
		cmd_args_with_src_path = cmd_args_with_src_path[: i - 2] + cmd_args_with_src_path[i + 1 :]

	return get_cmd_result(cmd_args_with_src_path)

def get_image_size(src_file_path):
	for cmd_args in get_image_cmd_versions(cmd_get_image_size_args):
		cmd_result = get_image_cmd_result(src_file_path, cmd_args)

		image_size = cmd_result.strip().lower()

		if re.match(pat_check_image_size, image_size):
			print('')
			print('Got image size:')
			print(image_size)

			return image_size

	return ''

def get_thumbnail_as_base64(src_file_path):
	for cmd_args in get_image_cmd_versions(cmd_make_thumbnail_args):
		temp_file_path = remove_temp_file(temp_thumb_file_path)

		cmd_result = get_image_cmd_result(src_file_path, cmd_args, check_thumbnail=True)

		if os.path.isfile(temp_file_path):
			raw_content = read_file(temp_file_path, mode='r+b')

			base64_content = (
				'data:image/'
			+	get_file_ext(temp_file_path).replace('jpg', 'jpeg')
			+	';base64,'
			+	base64.b64encode(raw_content).decode()
			)

			print('')
			print('Got thumbnail:')
			print(base64_content)

			return base64_content

	return ''



# - check old list content: -------------------------------------------------



if arg_dest_file_path:
	dest_file_path = arg_dest_file_path

print('')
print('Reading old file:')
print(dest_file_path)

t = timestamp()
mark_before = '//* generated file list start, saved at ' + t
mark_after = '//* generated file list end, saved at ' + t

content_before = content_after = ''

old_files = None
old_content = read_file(dest_file_path)

if old_content:
	print(str(len(old_content)) + ' bytes')

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

		print('')
		print('Parsing old file list:')

		old_files = json.loads(old_files_text)	# <- 'encoding' is ignored and deprecated.

		print('OK')

		print('')
		print('Parsing optional old variables:')

		for match in re.finditer(pat_var_value, old_vars_text):
			var_value = (
				match.group('Numeric')
			or	match.group('Quoted1')
			or	match.group('Quoted2')
			)

			if len(var_value) > 0:
				var_name = match.group('VarName')

				if var_name == src_dir_var_name:
					src_root_path = re.sub(pat_unslash, r'\1', var_value)

				elif var_name == thumbnail_size_var_name:
					try:
						if int(var_value) > 0:
							thumbnail_size = var_value
					except:
						continue

				else:
					continue

				print(var_name, '=', var_value)
		print('OK')
else:
	print('Empty or none.')



# - override old values with command-line arguments: ------------------------



if arg_src_root_path:    src_root_path    = arg_src_root_path
if arg_thumbnail_filter: thumbnail_filter = arg_thumbnail_filter
if arg_thumbnail_size:   thumbnail_size   = arg_thumbnail_size

thumbnail_size_arg = thumbnail_size + 'x' + thumbnail_size



# - get list of files: ------------------------------------------------------



print('')
print('Searching files in:')
print(src_root_path)

src_filenames_by_subdir = {}

files, dirs = get_separate_lists_of_files_and_dirs(src_root_path)

if files:
	src_filenames_by_subdir[''] = files

if dirs:
	for name in dirs:
		files, dirs2 = get_separate_lists_of_files_and_dirs(src_root_path + '/' + name)
		src_filenames_by_subdir[name] = files



# - get metadata of files: --------------------------------------------------



# https://stackoverflow.com/a/49868510
pat_separate_thousands = re.compile(r'(?<!^)(?=(\d{3})+$)')

new_files = [] if is_dest_array else {}


for dir_name, filenames in src_filenames_by_subdir.items():
	files = []
	for filename in filenames:
		path = src_root_path + '/' + dir_name + '/' + filename

		num_filesize = os.path.getsize(path)
		num_modtime = os.path.getmtime(path)

		text_filesize_short = get_formatted_filesize(num_filesize, space=' ', binary='', suffix='')
		text_filesize_bytes = re.sub(pat_separate_thousands, r' ', str(num_filesize))
		text_modtime = get_formatted_time(num_modtime)
		text_image_size = get_image_size(path) or get_old_field(old_files, dir_name, filename, 'pixels')
		text_thumbnail_base64 = get_thumbnail_as_base64(path) or get_old_field(old_files, dir_name, filename, 'thumbnail')

		files.append(
			{
				'name':		filename
			,	'pixels':	text_image_size
			,	'filesize':	text_filesize_short
			,	'bytes':	text_filesize_bytes
			,	'modtime':	text_modtime
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



# - compile results: --------------------------------------------------------



try:
	json_text = json.dumps(new_files, sort_keys=True, indent='\t', default=repr)	# <- use tabs, only in python 3
except TypeError:
	json_text = json.dumps(new_files, sort_keys=True, indent=4, default=repr)	# <- use spaces, fallback for python 2

json_lines = json_text.split('\n')



if old_content:
	replacements = [
		[src_dir_var_name, src_root_path]
	,	[thumbnail_size_var_name, thumbnail_size, True]	# <- write unquoted
	]

	def replace_var(match):
		var_name = match.group('VarName')

		for replacement in replacements:
			if var_name == replacement[0]:
				return (
					var_name
				+	match.group('Operator')
				+	(
						replacement[1] if len(replacement) > 2 and replacement[2]
						else get_quoted_value_text(replacement[1])
					)
				)

		return match.group(0)

	content_before = re.sub(pat_var_value, replace_var, content_before)
	content_after = re.sub(pat_var_value, replace_var, content_after)
else:
	content_before = '''
//* Notes to avoid generation trouble:
//*	Keep paths as simple one-line strings.
//*	Keep JSON as strictly simple and valid.

// var TESTING = true;

// var EXAMPLE_NOTICE = true;

var ''' + thumbnail_size_var_name + ''' = ''' + thumbnail_size + ''';

var ''' + src_dir_var_name + ''' = ''' + quote + src_root_path + quote + ''';

var ''' + filelist_var_name + ''' = '''

	content_after = ''';
'''



new_content = '\n'.join([
	content_before + json_lines[0]
,	mark_before
,	'\n'.join(json_lines[1:-1])
,	mark_after
,	json_lines[-1] + content_after
])



# - output results: ---------------------------------------------------------



if TEST:
	print('')
	print('Result output for testing, not saved:')
else:
	print('')
	print('Result output for saving:')

print('--------        --------        --------        --------')
print(new_content)
print('--------        --------        --------        --------')

if not TEST:
	remove_temp_file()

	print('')
	print('Saving to file:')
	print(dest_file_path)

	rewrite_file(dest_file_path, new_content)

	print('')
	print('Done.')
