
# sprite_dress_up



## purpose

Parse artwork project files (ORA, PSD) into menu of parts and batch export of all versions to image files (PNG) completely on the client side, using a web browser with modern JavaScript support.



## client side

Open one of `index.<lang>.htm` files in a web-browser, drop files on the page or use menu at the top.



## server side

### update_config.py

This script can be used manually on the server side to quickly update the table of example files after adding or modifying them.



#### Requirements:

* Python (tested with versions 2.7.17 and 3.8.1)
* ImageMagick (tested with versions 6.8.9-9 and 7.0.9-27) for project file canvas measurement and thumbnail generation, called by name or manually configurable path.



#### Command line arguments:

`-test`
— run simulation for debug: do not save final config, do not clean up last saved temp file, but do everything else normally and show output.

`-test-filters` or
`-filters`
— save a thumbnail file named `<...>_<FilterName>.png` for each resizing method supported by installed ImageMagick, to compare.

`-thumb-filter <FilterName>` or
`-filter <FilterName>`
— set thumbnail resizing method, one of supported by installed ImageMagick. Default is `Welch`.

`-thumb-size <Number>` or
`-size <Number>`
— set longest dimension of thumbnails to a positive number of pixels. Default is 20.

`-imagemagick-6` or
`-im6`
— use ImageMagick version 6.x command format, such as `convert <args>`.

`-imagemagick-7` or
`-im7`
— use ImageMagick version 7.x command format, such as `magick convert <args>`. If no version is given, script will try them all, starting with later.



#### Command line example:
```
python ./update_config.py -im7 -filter Sinc
```



#### Notes about some tested filters:

* `Welch` is super-fast, adds mild visual artifacts on vector-like icons. Looks better with thumbnail sizes bigger than 30.
* `Sinc` is slower, sharper on high-detail high-res images, very bad artifacts on vector-like icons.
* `Lanczos` and its variants are slower, look okay, but almost the same as `Welch` on all examples.
* Most of others available are too blocky or too blurry on the test projects files.



## included libraries

ORA file parser - modified version of [ora.js](https://github.com/zsgalusz/ora.js).

PSD file parser - unmodified [fork](https://github.com/imcuttle/psd.js) of [psd.js](https://github.com/meltingice/psd.js).

PNG file parser - unmodified [UPNG.js](https://github.com/photopea/UPNG.js) with [Pako.js](https://github.com/nodeca/pako).

ZIP file parser - unmodified [zip.js](https://github.com/gildas-lormeau/zip.js).
