
(function () {

	'use strict';

	var
		window = require('window'),
		_ = require('_'),
		$ = require('$'),

		Globals = require('Common/Globals'),
		Utils = require('Common/Utils'),
		Links = require('Common/Links'),
		Events = require('Common/Events'),

		Settings = require('Storage/Settings'),

		AbstractBoot = require('Knoin/AbstractBoot')
	;

	/**
	 * @constructor
	 * @param {RemoteStorage|AdminRemoteStorage} Remote
	 * @extends AbstractBoot
	 */
	function AbstractApp(Remote)
	{
		AbstractBoot.call(this);

		this.isLocalAutocomplete = true;

		this.iframe = $('<iframe style="display:none" src="javascript:;" />').appendTo('body');

		Globals.$win.on('error', function (oEvent) {
			if (oEvent && oEvent.originalEvent && oEvent.originalEvent.message &&
				-1 === Utils.inArray(oEvent.originalEvent.message, [
					'Script error.', 'Uncaught Error: Error calling method on NPObject.'
				]))
			{
				Remote.jsError(
					Utils.emptyFunction,
					oEvent.originalEvent.message,
					oEvent.originalEvent.filename,
					oEvent.originalEvent.lineno,
					window.location && window.location.toString ? window.location.toString() : '',
					Globals.$html.attr('class'),
					Utils.microtime() - Globals.now
				);
			}
		});

		Globals.$doc.on('keydown', function (oEvent) {
			if (oEvent && oEvent.ctrlKey)
			{
				Globals.$html.addClass('rl-ctrl-key-pressed');
			}
		}).on('keyup', function (oEvent) {
			if (oEvent && !oEvent.ctrlKey)
			{
				Globals.$html.removeClass('rl-ctrl-key-pressed');
			}
		});
	}

	_.extend(AbstractApp.prototype, AbstractBoot.prototype);

	AbstractApp.prototype.remote = function ()
	{
		return null;
	};

	AbstractApp.prototype.data = function ()
	{
		return null;
	};

	/**
	 * @param {string} sLink
	 * @return {boolean}
	 */
	AbstractApp.prototype.download = function (sLink)
	{
		var
			oE = null,
			oLink = null,
			sUserAgent = window.navigator.userAgent.toLowerCase()
		;

		if (sUserAgent && (sUserAgent.indexOf('chrome') > -1 || sUserAgent.indexOf('chrome') > -1))
		{
			oLink = window.document.createElement('a');
			oLink['href'] = sLink;

			if (window.document['createEvent'])
			{
				oE = window.document['createEvent']('MouseEvents');
				if (oE && oE['initEvent'] && oLink['dispatchEvent'])
				{
					oE['initEvent']('click', true, true);
					oLink['dispatchEvent'](oE);
					return true;
				}
			}
		}

		if (Globals.bMobileDevice)
		{
			window.open(sLink, '_self');
			window.focus();
		}
		else
		{
			this.iframe.attr('src', sLink);
	//		window.document.location.href = sLink;
		}

		return true;
	};

	AbstractApp.prototype.googlePreviewSupportedCache = null;

	/**
	 * @return {boolean}
	 */
	AbstractApp.prototype.googlePreviewSupported = function ()
	{
		if (null === this.googlePreviewSupportedCache)
		{
			this.googlePreviewSupportedCache = !!Settings.settingsGet('AllowGoogleSocial') &&
				!!Settings.settingsGet('AllowGoogleSocialPreview');
		}
		
		return this.googlePreviewSupportedCache;
	};

	/**
	 * @param {string} sTitle
	 */
	AbstractApp.prototype.setTitle = function (sTitle)
	{
		sTitle = ((Utils.isNormal(sTitle) && 0 < sTitle.length) ? sTitle + ' - ' : '') +
			Settings.settingsGet('Title') || '';

		window.document.title = sTitle + ' ...';
		window.document.title = sTitle;
	};

	AbstractApp.prototype.redirectToAdminPanel = function ()
	{
		_.delay(function () {
			window.location.href = Links.rootAdmin();
		}, 100);
	};

	AbstractApp.prototype.clearClientSideToken = function ()
	{
		if (window.__rlah_clear)
		{
			window.__rlah_clear();
		}
	};

	/**
	 * @param {boolean=} bLogout = false
	 * @param {boolean=} bClose = false
	 */
	AbstractApp.prototype.loginAndLogoutReload = function (bLogout, bClose)
	{
		var
			kn = require('Knoin/Knoin'),
			sCustomLogoutLink = Utils.pString(Settings.settingsGet('CustomLogoutLink')),
			bInIframe = !!Settings.settingsGet('InIframe')
		;

		bLogout = Utils.isUnd(bLogout) ? false : !!bLogout;
		bClose = Utils.isUnd(bClose) ? false : !!bClose;

		if (bLogout)
		{
			this.clearClientSideToken();
		}

		if (bLogout && bClose && window.close)
		{
			window.close();
		}

		sCustomLogoutLink = sCustomLogoutLink || './';
		if (bLogout && window.location.href !== sCustomLogoutLink)
		{
			_.delay(function () {
				if (bInIframe && window.parent)
				{
					window.parent.location.href = sCustomLogoutLink;
				}
				else
				{
					window.location.href = sCustomLogoutLink;
				}
			}, 100);
		}
		else
		{
			kn.routeOff();
			kn.setHash(Links.root(), true);
			kn.routeOff();

			_.delay(function () {
				if (bInIframe && window.parent)
				{
					window.parent.location.reload();
				}
				else
				{
					window.location.reload();
				}
			}, 100);
		}
	};

	AbstractApp.prototype.historyBack = function ()
	{
		window.history.back();
	};

	AbstractApp.prototype.bootstart = function ()
	{
		Events.pub('rl.bootstart');

		var
			ssm = require('ssm'),
			ko = require('ko')
		;

		ko.components.register('SaveTrigger', require('Component/SaveTrigger'));
		ko.components.register('Input', require('Component/Input'));
		ko.components.register('Select', require('Component/Select'));
		ko.components.register('TextArea', require('Component/TextArea'));
		ko.components.register('Radio', require('Component/Radio'));

		if (Settings.settingsGet('MaterialDesign'))
		{
			ko.components.register('Checkbox', require('Component/MaterialDesign/Checkbox'));
		}
		else
		{
			ko.components.register('Checkbox', require('Component/Checkbox'));
		}

		Utils.initOnStartOrLangChange(function () {
			Utils.initNotificationLanguage();
		}, null);

		_.delay(function () {
			Utils.windowResize();
		}, 1000);

		ssm.addState({
			'id': 'mobile',
			'maxWidth': 767,
			'onEnter': function() {
				Globals.$html.addClass('ssm-state-mobile');
				Events.pub('ssm.mobile-enter');
			},
			'onLeave': function() {
				Globals.$html.removeClass('ssm-state-mobile');
				Events.pub('ssm.mobile-leave');
			}
		});

		ssm.addState({
			'id': 'tablet',
			'minWidth': 768,
			'maxWidth': 999,
			'onEnter': function() {
				Globals.$html.addClass('ssm-state-tablet');
			},
			'onLeave': function() {
				Globals.$html.removeClass('ssm-state-tablet');
			}
		});

		ssm.addState({
			'id': 'desktop',
			'minWidth': 1000,
			'maxWidth': 1400,
			'onEnter': function() {
				Globals.$html.addClass('ssm-state-desktop');
			},
			'onLeave': function() {
				Globals.$html.removeClass('ssm-state-desktop');
			}
		});

		ssm.addState({
			'id': 'desktop-large',
			'minWidth': 1400,
			'onEnter': function() {
				Globals.$html.addClass('ssm-state-desktop-large');
			},
			'onLeave': function() {
				Globals.$html.removeClass('ssm-state-desktop-large');
			}
		});

		Events.sub('ssm.mobile-enter', function () {
			Globals.leftPanelDisabled(true);
		});

		Events.sub('ssm.mobile-leave', function () {
			Globals.leftPanelDisabled(false);
		});

		Globals.leftPanelDisabled.subscribe(function (bValue) {
			Globals.$html.toggleClass('rl-left-panel-disabled', bValue);
		});

		ssm.ready();
	};

	module.exports = AbstractApp;

}());