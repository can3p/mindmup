/*global jQuery, MM, _ */
MM.LayoutExportController = function (exportFunctions, configurationGenerator, storageApi, activityLog) {
	'use strict';
	var self = this,
		category = 'Map',
		getEventType = function (format) {
			if (!format) {
				return 'Export';
			}
			return format.toUpperCase() + ' Export';
		};

	self.startExport = function (format, exportProperties) {
		var deferred = jQuery.Deferred(),
			eventType = getEventType(format),
			isStopped = function () {
				return deferred.state() !== 'pending';
			},
			reject = function (reason, fileId) {
				activityLog.log(category, eventType + ' failed', reason);
				deferred.reject(reason, fileId);
			},
			exported = exportFunctions[format](),
			layout = _.extend({}, exported, exportProperties);
		if (_.isEmpty(exported)) {
			return deferred.reject('empty').promise();
		}
		activityLog.log(category, eventType + ' started');
		configurationGenerator.generateExportConfiguration(format).then(
			function (exportConfig) {
				var fileId = exportConfig.s3UploadIdentifier;
				storageApi.save(JSON.stringify(layout), exportConfig, {isPrivate: true}).then(
					function () {
						var pollTimer = activityLog.timer(category, eventType + ':polling-completed'),
							pollTimeoutTimer = activityLog.timer(category, eventType + ':polling-timeout'),
							pollErrorTimer = activityLog.timer(category, eventType + ':polling-error'),
							resolve = function () {
								pollTimer.end();
								activityLog.log(category, eventType + ' completed');
								deferred.resolve(exportConfig.signedOutputUrl);
							};
						storageApi.poll(exportConfig.signedErrorListUrl, {stoppedSemaphore: isStopped, sleepPeriod: 15000}).then(
							function () {
								pollErrorTimer.end();
								reject('generation-error', fileId);
							});
						storageApi.poll(exportConfig.signedOutputListUrl, {stoppedSemaphore: isStopped, sleepPeriod: 5000}).then(
							resolve,
							function (reason) {
								pollTimeoutTimer.end();
								reject(reason, fileId);
							});
					},
					reject
				);
			},
			reject
		);
		return deferred.promise();
	};
};

jQuery.fn.layoutExportWidget = function (layoutExportController) {
	'use strict';
	return this.each(function () {
		var self = jQuery(this),
			selectedFormat = function () {
				var selector = self.find('[data-mm-role=format-selector]');
				if (selector && selector.val()) {
					return selector.val();
				} else {
					return self.data('mm-format');
				}
			},
			confirmElement = self.find('[data-mm-role=export]'),
			setState = function (state) {
				self.find('.visible').hide();
				self.find('.visible' + '.' + state).show();
			},
			exportComplete = function (url) {
				self.find('[data-mm-role=output-url]').attr('href', url);
				setState('done');
			},
			getExportMetadata = function () {
				var form = self.find('form[data-mm-role=export-parameters]'),
					exportType = {};
				if (form) {
					form.find('button.active').add(form.find('select')).add(form.find('input[type=hidden]')).each(function () {
						exportType[jQuery(this).attr('name')] = jQuery(this).val();
					});
				}
				return exportType;
			},
			exportFailed = function (reason, fileId) {
				self.find('[data-mm-role=contact-email]').attr('href', function () { return 'mailto:' + jQuery(this).text() + '?subject=MindMup%20' + selectedFormat().toUpperCase() + '%20Export%20Error%20' + fileId; });
				self.find('[data-mm-role=file-id]').html(fileId);
				self.find('.error span').hide();
				setState('error');

				var predefinedMsg = self.find('[data-mm-role=' + reason + ']');
				if (predefinedMsg.length > 0) {
					predefinedMsg.show();
				} else {
					self.find('[data-mm-role=error-message]').html(reason).show();
				}
			},
			doExport = function () {
				setState('inprogress');
				layoutExportController.startExport(selectedFormat(), {'export': getExportMetadata()}).then(exportComplete, exportFailed);
			};
		self.find('form').submit(function () {return false; });
		confirmElement.click(doExport).keydown('space', doExport);
		self.modal({keyboard: true, show: false});
		self.on('show', function () {
			setState('initial');
		}).on('shown', function () {
			confirmElement.focus();
		});
	});
};
MM.buildMapLayoutExporter = function (mapModel, resourceTranslator) {
	'use strict';
	return function () {
		var layout = mapModel.getCurrentLayout();
		if (layout && layout.nodes) {
			_.each(layout.nodes, function (node) {
				if (node.attr && node.attr.icon && node.attr.icon.url) {
					node.attr.icon.url = resourceTranslator(node.attr.icon.url);
				}
			});
		}
		return layout;
	};
};
