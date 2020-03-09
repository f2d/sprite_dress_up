
# sprite_dress_up

Parse artwork project files (ORA, PSD) into menu of parts and batch export of all versions to image files (PNG) completely on the client side, using a web browser with modern JavaScript support.



## client side

Open one of `index.<lang>.htm` in a web-browser, drop files on the page or use menu at the top.



## server side

`update_config.py` is a Python script (tested with versions 2.x and 3.x) used on the server side to update the table of examples stored there.

Automatic canvas measurement and thumbnail generation on server currently requires ImageMagick (tested with versions 6.8.9-9 and 7.0.9-27), called by name or manually configurable path.



Command line arguments for `update_config.py`:

`-test` - run simulation for debug: do not save final config, do not clean up last saved temp file, but do everything else normally and show output.

`-test-filters` or `-filters` - save a thumbnail file named `<...>_FilterName.png` for each resizing method supported by installed ImageMagick, to compare.

`-thumb-filter <FilterName>` or `-filter <FilterName>` - set thumbnail resizing method. Supported names are defined by installed ImageMagick. "Welch" is used here by default.

`-thumb-size <Number>` or `-size <Number>` - set longest dimension of thumbnails to a positive number. Default is 20 pixels.

`-imagemagick-6` or `-im6` - use ImageMagick version 6.x command format, such as `convert <args>`.

`-imagemagick-7` or `-im7` - use ImageMagick version 7.x command format, such as `magick convert <args>`. If no version is given, script will try them all, starting with later.



Command line example:
```
python ./update_config.py -im7 -filter Sinc
```



## included libraries

ORA file parser - modified version of [ora.js](https://github.com/zsgalusz/ora.js).

PSD file parser - unmodified [fork](https://github.com/imcuttle/psd.js) of [psd.js](https://github.com/meltingice/psd.js).

PNG file parser - unmodified [UPNG.js](https://github.com/photopea/UPNG.js) with [Pako.js](https://github.com/nodeca/pako).

ZIP file parser - unmodified [zip.js](https://github.com/gildas-lormeau/zip.js).
