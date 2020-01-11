#!/usr/bin/env python
# -*- coding: UTF-8 -*-

# Python 2 or 3 should work.

import datetime, json, math, os, re, sys, time

TEST = len(sys.argv) > 1



# - config: -----------------------------------------------------------------



src_root_path = 'example_project_files'
dest_file_path = 'config.js'

src_dir_var_name = 'exampleRootDir'
filelist_var_name = 'exampleProjectFiles'

quote = "'"

is_dest_array = True



# - internal config, do not change: -----------------------------------------



format_epoch = '%Epoch'	# <- not from python library, but custom str-replaced
# format_ymd = '%Y-%m-%d'
# format_hms = '%H-%M-%S'
format_print = '%Y-%m-%d %H:%M:%S'



# - functions: --------------------------------------------------------------



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

def get_separate_lists_of_files_and_dirs(root_path):
	files = []
	dirs = []

	for name in os.listdir(root_path):
		path = root_path + '/' + name

		if os.path.isfile(path): files.append(name)
		elif os.path.isdir(path): dirs.append(name)

	return (files, dirs)



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
			old_files = json.loads(content, encoding='utf-8')
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


for dir_name, filenames in src_filenames_by_subdir.items():
	files = []
	for filename in filenames:
		path = src_root_path + '/' + dir_name + '/' + filename

		sz_bytes = os.path.getsize(path)
		mt_stamp = os.path.getmtime(path)

		sz_text_short = get_formatted_filesize(sz_bytes, space=' ', binary='', suffix='')
		sz_text_bytes = re.sub(pat_separate_thousands, r' ', str(sz_bytes))
		mt_text = get_formatted_time(mt_stamp)
		px_text = get_old_field(old_files, dir_name, filename, 'pixels')

		files.append(
			{
				'name':		filename
			,	'pixels':	px_text
			,	'filesize':	sz_text_short
			,	'bytes':	sz_text_bytes
			,	'modtime':	mt_text
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



print('')

if TEST:
	print('Result output fot testing, not saved:')
else:
	print('Result output fot saving:')

print('--------        --------        --------        --------')
print(new_content)
print('--------        --------        --------        --------')

if not TEST:
	print('Saving to file:')
	print(dest_file_path)

	rewrite_file(dest_file_path, new_content)

	print('Done.')
