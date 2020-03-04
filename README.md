
# sprite_dress_up

Parse artwork project files (ORA, PSD) into menu of parts and batch export of all versions to image files (PNG) completely on the client side, using a web browser with modern JavaScript support.

## included examples

`update_config.py` is a Python script (tested with versions 2.x and 3.x) used on the server side to update the table of examples stored there.

Automatic canvas measurement and thumbnail generation on server currently requires ImageMagick (tested with versions 6.8.9-9 and 7.0.9-27), called by name or manually configurable path.

Thumbnail resizing filter can be changed from command line like this:
```
python update_config.py -filter Sinc
```
