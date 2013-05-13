/*global jQuery*/
jQuery.fn.mapStatusWidget = function (mapController) {
	'use strict';
	var element = this,
		oldIdea,
		updateSharable = function () {
			if (!mapController.isMapSharable()) {
				element.removeClass('map-sharable').addClass('map-not-sharable');
			} else {
				element.removeClass('map-not-sharable').addClass('map-sharable');
			}
		};
	mapController.addEventListener('mapLoaded', function (idea, mapId) {
		if (!mapId || mapId.length < 3) { /* imported, no repository ID */
			jQuery('body').removeClass('map-unchanged').addClass('map-changed');
		} else {
			element.removeClass('map-changed').addClass('map-unchanged');
		}
		if (oldIdea !== idea) {
			oldIdea = idea;
			idea.addEventListener('changed', function () {
				if (element.hasClass('map-unchanged')) {
					element.removeClass('map-unchanged').addClass('map-changed');
					element.removeClass('map-sharable').addClass('map-not-sharable');
				}

			});
		}
		updateSharable();
	});
	mapController.addEventListener('mapSaved', function () {
		element.removeClass('map-changed').addClass('map-unchanged');
		updateSharable();
	});
};