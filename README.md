﻿
# sprite_dress_up



## Purpose

1. Parse artwork project files (ORA, PSD) into menu of parts to preview preset versions.
2. Easy batch export of all versions into image files (PNG), separated or joined.

Completely on the client side, using a web browser with modern JavaScript support.



## Client side

Open one of `index.<lang>.htm` files in a web-browser, drop files on the page or use menu at the top.

Using project files saved in a maximum compatibility mode is recommended.

Recomposition functionality is already usable to some extent, but lacks support of a lot of advanced project file features (e.g. smart objects, text, vectors, procedural effects), and rendering quality is more of a proof-of-concept than production-ready.



## Server side

### update_config.py

This script can be used manually on the server side to quickly update the table of example files after adding or modifying them.



#### Requirements:

* **Python** (tested with versions 2.7.17 and 3.8.1)
* **ImageMagick** (tested with versions 6.8.9-9 and 7.0.9-27) for project file canvas measurement and thumbnail generation, called by name or manually configurable path.

#### Optional:

* Python modules for colored text in terminal output, both needed, or colors will not be used:
	* **termcolor**
	* **colorama**
* **optipng**
* **leanify**



#### Command line arguments:

`-test` or
`-t`
— run simulation for debug: do not save final config, do not clean up last saved temp file, but do everything else normally and show output.

`-test-filters` or
`-filters` or
`-f`
— save all thumbnails to compare, one for each resizing method supported by installed ImageMagick. Files are saved as `<...>_<FilterName>.png` in a subfolder named by target image size.

`-resize-filter <FilterName>` or
`-thumb-filter <FilterName>` or
`-filter <FilterName>` or
`-r <FilterName>`
— set resizing method, one of supported by installed ImageMagick. Default is `Welch`.

`-thumb-size <Number>` or
`-size <Number>` or
`-s <Number>`
— set longest dimension of thumbnails to a positive number of pixels. Default is 20.

`-preview-size <Number>` or
`-zoom-size <Number>` or
`-z <Number>`
— set longest dimension of zoomed-in thumbnails. Default is 80.

`-imagemagick-6` or
`-im6` or
`-6`
— use ImageMagick version 6.x command format, such as `convert <args>`.

`-imagemagick-7` or
`-im7` or
`-7`
— use ImageMagick version 7.x command format, such as `magick convert <args>`. If no version is given, script will try them all, starting with later.

`-optipng` or
`-o`
— use OptiPNG command with `-fix` argument on each image after resize.

`-leanify` or
`-l`
— use Leanify command on each image after resize. If OptiPNG if also used, it is called first to fix and prevent possible Leanify errors.



#### Command line example:
```
python ./update_config.py -im7 -filter Sinc
```



#### Notes about some tested filters:

* `Welch` is super-fast, adds mild visual artifacts on vector-like icons. Looks better with thumbnail sizes bigger than 30.
* `Sinc` is slower, sharper on high-detail high-res images, very bad artifacts on vector-like icons.
* `Lanczos` and its variants are slower, look okay, but almost the same as `Welch` on all examples.
* Most of others available are too blocky or too blurry on the test projects files.



## Included libraries

ORA file parser - heavily modified version of [ora.js](https://github.com/zsgalusz/ora.js).
Original version also works here, but with many limitations.

PSD file parser - lightly modified [build](https://github.com/meltingice/psd.js/issues/154#issuecomment-446279652)
and optional [fork](https://github.com/imcuttle/psd.js) of [psd.js](https://github.com/meltingice/psd.js).
Original version does not work here.

PNG file parser - unmodified [UPNG.js](https://github.com/photopea/UPNG.js) with [Pako.js](https://github.com/nodeca/pako).
Not used yet.

ZIP file parser - unmodified [zip.js](https://github.com/gildas-lormeau/zip.js) with [zlib-asm](https://github.com/ukyo/zlib-asm).
