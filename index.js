
function loadScriptOrFallback() {

	function tryNextScript(evt) {
		while (
			filePaths
		&&	filePaths.length > 0
		) {
		var	filePath = '' + filePaths.shift();

			if (filePath.length > 0) {
			var	script = document.createElement('script');
				script.onerror = tryNextScript;
				script.onload = stopHereIfReady;
				script.src = filePath;
				document.head.appendChild(script);

				return;
			}
		}
	}

	function stopHereIfReady(evt) {
		if (typeof initUI === 'undefined') {
			tryNextScript(evt);

			return;
		}

		USE_ES5_JS = /es5[^\/]*$/i.test(evt.target.src);

		if (typeof initUI === 'function') {
			initUI();
		}
	}

var	filePaths = Array.prototype.slice.call(arguments);

	tryNextScript();
}

var USE_ES5_JS;

loadScriptOrFallback(
	'index.es-latest.js'
// ,	'lib/util/regenerator-runtime-0.13.7/runtime.js'
// ,	'index.es5.js'
);
