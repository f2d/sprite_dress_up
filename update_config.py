#!/usr/bin/env python
# -*- coding: UTF-8 -*-

# Python 2 or 3 should work.

import base64, datetime, json, math, os, re, subprocess, sys, time, zipfile



# - command line arguments: -------------------------------------------------



TEST = ('t' in sys.argv) or ('test' in sys.argv)

IM_6 = ('--imagemagick-6' in sys.argv) or ('-im6' in sys.argv) or ('6' in sys.argv)
IM_7 = ('--imagemagick-7' in sys.argv) or ('-im7' in sys.argv) or ('7' in sys.argv)
IM_UNDEFINED = not (IM_6 or IM_7)



# - config - source files and result content: -------------------------------



src_root_path = 'example_project_files'
dest_file_path = 'config.js'

src_dir_var_name = 'exampleRootDir'
filelist_var_name = 'exampleProjectFiles'

quote = '"'

is_dest_array = True



# - config - external helper programs: --------------------------------------



converter_exe_path = 'magick'			# <- full path example: 'd:/programs/ImageMagick_7/magick.exe'

merged_layer_suffix = '[0]'			# <- to use pre-merged layer
temp_layer_file_path = 'temp_layer.png'
temp_thumb_file_path = 'temp_thumb.png'
src_file_path_placeholder = '<src_placeholder>'

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
,	'-thumbnail'
,	'16x16'
,	'png32:' + temp_thumb_file_path
]

pat_check_image_size = re.compile(r'^(\d+)x(\d+)$', re.U | re.I)



# - config - internal, do not change: ---------------------------------------



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

def get_image_cmd_result(src_file_path, cmd_args, check_thumbnail=False):
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

	# must get list instead of map object, or it will not run in python3:
	cmd_args_with_src_path = list(map(
		lambda x: (
			# os.path.abspath(src_file_path)
			# './' + src_file_path
			src_file_path
			if x == src_file_path_placeholder
			else x
		)
	,	cmd_args
	))

	print('')
	print('Running command:')
	print(' '.join(quoted_list(cmd_args_with_src_path)))

	# https://stackoverflow.com/a/16198668
	try:
		output = subprocess.check_output(
			cmd_args_with_src_path
		# ,	stderr=subprocess.STDOUT
		# ,	shell=True	# <- IM does not work in Linux terminal with this
		# ,	timeout=3
		# ,	universal_newlines=True
		)
	except subprocess.CalledProcessError as e:
		print('')
		print('Error code {}, command output:'.format(e.returncode))
		print(get_str_from_bytes(e.output))
	else:
		output = get_str_from_bytes(output)

		print('')
		print('Done, command output:')
		print(output)

		return output

	return ''

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
	, re.I | re.S | re.U | re.X)

	res = re.search(pat_array_value, old_content)
	if res:
		content_before = res.group('Before')
		content_after = res.group('After')
		old_vars = content_before + content_after

		pat_comment_line = re.compile(r'//([^\r\n]*)', re.U)
		pat_comment_block = re.compile(r'/\*(.*?)\*/', re.U | re.S)

		content = res.group('OldFileList')
		content = re.sub(pat_comment_line, '', content)
		content = re.sub(pat_comment_block, '', content)

		print('')
		print('Parsing old file:')

		try:
			old_files = json.loads(content)	# 'encoding' is ignored and deprecated.
			print('OK')
		except Exception as e:
			print(e)

		pat_quoted_value = re.compile(r'''
		\b''' + src_dir_var_name + r'''\b\s*=\s*
		(
			'(?P<PathQ1>([\\\\]'|[^'])*)'
		|	"(?P<PathQ2>([\\\\]"|[^"])*)"
		)
		'''
		, re.I | re.S | re.U | re.X)

		res = re.search(pat_quoted_value, old_vars)
		if res:
			t = res.group('PathQ1') or res.group('PathQ2')
			if t:
				pat_unslash = re.compile(r'\\(.)')
				src_root_path = re.sub(pat_unslash, r'\1', t)
else:
	print('Empty or none.')

if not content_before:
	content_before = '''
//* Notes to avoid generation trouble:
//*	Keep paths as simple one-line strings.
//*	Keep JSON as strictly simple and valid.

// var TESTING = true;

// var EXAMPLE_NOTICE = true;

var ''' + src_dir_var_name + ''' = ''' + quote + src_root_path + quote + ''';

var ''' + filelist_var_name + ''' = '''

if not content_after:
	content_after = ''';
'''



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
	json_text = json.dumps(new_files, sort_keys=True, indent='\t', default=repr)
except TypeError:
	json_text = json.dumps(new_files, sort_keys=True, indent=4, default=repr)

json_lines = json_text.split('\n')

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
