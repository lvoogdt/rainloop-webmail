
(function () {

	'use strict';

	var
		window = require('window'),
		_ = require('_'),
		$ = require('$'),
		ko = require('ko'),
		key = require('key'),

		Utils = require('Common/Utils'),
		Enums = require('Common/Enums'),
		Globals = require('Common/Globals'),
		Links = require('Common/Links'),

		Settings = require('Storage/Settings'),
		Cache = require('Storage/User/Cache'),
		Data = require('Storage/User/Data'),

		kn = require('Knoin/Knoin'),
		AbstractView = require('Knoin/AbstractView')
	;

	/**
	 * @constructor
	 * @extends AbstractView
	 */
	function FolderListMailBoxUserView()
	{
		AbstractView.call(this, 'Left', 'MailFolderList');

		this.oContentVisible = null;
		this.oContentScrollable = null;

		this.messageList = Data.messageList;
		this.folderList = Data.folderList;
		this.folderListSystem = Data.folderListSystem;
		this.foldersChanging = Data.foldersChanging;

		this.leftPanelDisabled = Globals.leftPanelDisabled;

		this.iDropOverTimer = 0;

		this.allowContacts = !!Settings.settingsGet('ContactsIsAllowed');

		kn.constructorEnd(this);
	}

	kn.extendAsViewModel(['View/User/MailBox/FolderList', 'View/App/MailBox/FolderList', 'MailBoxFolderListViewModel'], FolderListMailBoxUserView);
	_.extend(FolderListMailBoxUserView.prototype, AbstractView.prototype);

	FolderListMailBoxUserView.prototype.onBuild = function (oDom)
	{
		this.oContentVisible = $('.b-content', oDom);
		this.oContentScrollable = $('.content', this.oContentVisible);

		var self = this;

		oDom
			.on('click', '.b-folders .e-item .e-link .e-collapsed-sign', function (oEvent) {

				var
					oFolder = ko.dataFor(this),
					bCollapsed = false
				;

				if (oFolder && oEvent)
				{
					bCollapsed = oFolder.collapsed();
					require('App/User').setExpandedFolder(oFolder.fullNameHash, bCollapsed);

					oFolder.collapsed(!bCollapsed);
					oEvent.preventDefault();
					oEvent.stopPropagation();
				}
			})
			.on('click', '.b-folders .e-item .e-link.selectable', function (oEvent) {

				oEvent.preventDefault();

				var
					oFolder = ko.dataFor(this)
				;

				if (oFolder)
				{
					if (Enums.Layout.NoPreview === Data.layout())
					{
						Data.message(null);
					}

					if (oFolder.fullNameRaw === Data.currentFolderFullNameRaw())
					{
						Cache.setFolderHash(oFolder.fullNameRaw, '');
					}

					kn.setHash(Links.mailBox(oFolder.fullNameHash));
				}
			})
		;

		key('up, down', Enums.KeyState.FolderList, function (event, handler) {

			var
				iIndex = -1,
				iKeyCode = handler && 'up' === handler.shortcut ? 38 : 40,
				$items = $('.b-folders .e-item .e-link:not(.hidden):visible', oDom)
			;

			if (event && $items.length)
			{
				iIndex = $items.index($items.filter('.focused'));
				if (-1 < iIndex)
				{
					$items.eq(iIndex).removeClass('focused');
				}

				if (iKeyCode === 38 && iIndex > 0)
				{
					iIndex--;
				}
				else if (iKeyCode === 40 && iIndex < $items.length - 1)
				{
					iIndex++;
				}

				$items.eq(iIndex).addClass('focused');
				self.scrollToFocused();
			}

			return false;
		});

		key('enter', Enums.KeyState.FolderList, function () {
			var $items = $('.b-folders .e-item .e-link:not(.hidden).focused', oDom);
			if ($items.length && $items[0])
			{
				self.folderList.focused(false);
				$items.click();
			}

			return false;
		});

		key('space', Enums.KeyState.FolderList, function () {
			var bCollapsed = true, oFolder = null, $items = $('.b-folders .e-item .e-link:not(.hidden).focused', oDom);
			if ($items.length && $items[0])
			{
				oFolder = ko.dataFor($items[0]);
				if (oFolder)
				{
					bCollapsed = oFolder.collapsed();
					require('App/User').setExpandedFolder(oFolder.fullNameHash, bCollapsed);
					oFolder.collapsed(!bCollapsed);
				}
			}

			return false;
		});

		key('esc, tab, shift+tab, right', Enums.KeyState.FolderList, function () {
			self.folderList.focused(false);
			return false;
		});

		self.folderList.focused.subscribe(function (bValue) {
			$('.b-folders .e-item .e-link.focused', oDom).removeClass('focused');
			if (bValue)
			{
				$('.b-folders .e-item .e-link.selected', oDom).addClass('focused');
			}
		});
	};

	FolderListMailBoxUserView.prototype.messagesDropOver = function (oFolder)
	{
		window.clearTimeout(this.iDropOverTimer);
		if (oFolder && oFolder.collapsed())
		{
			this.iDropOverTimer = window.setTimeout(function () {
				oFolder.collapsed(false);
				require('App/User').setExpandedFolder(oFolder.fullNameHash, true);
				Utils.windowResize();
			}, 500);
		}
	};

	FolderListMailBoxUserView.prototype.messagesDropOut = function ()
	{
		window.clearTimeout(this.iDropOverTimer);
	};

	FolderListMailBoxUserView.prototype.scrollToFocused = function ()
	{
		if (!this.oContentVisible || !this.oContentScrollable)
		{
			return false;
		}

		var
			iOffset = 20,
			oFocused = $('.e-item .e-link.focused', this.oContentScrollable),
			oPos = oFocused.position(),
			iVisibleHeight = this.oContentVisible.height(),
			iFocusedHeight = oFocused.outerHeight()
		;

		if (oPos && (oPos.top < 0 || oPos.top + iFocusedHeight > iVisibleHeight))
		{
			if (oPos.top < 0)
			{
				this.oContentScrollable.scrollTop(this.oContentScrollable.scrollTop() + oPos.top - iOffset);
			}
			else
			{
				this.oContentScrollable.scrollTop(this.oContentScrollable.scrollTop() + oPos.top - iVisibleHeight + iFocusedHeight + iOffset);
			}

			return true;
		}

		return false;
	};

	/**
	 *
	 * @param {FolderModel} oToFolder
	 * @param {{helper:jQuery}} oUi
	 */
	FolderListMailBoxUserView.prototype.messagesDrop = function (oToFolder, oUi)
	{
		if (oToFolder && oUi && oUi.helper)
		{
			var
				sFromFolderFullNameRaw = oUi.helper.data('rl-folder'),
				bCopy = Globals.$html.hasClass('rl-ctrl-key-pressed'),
				aUids = oUi.helper.data('rl-uids')
			;

			if (Utils.isNormal(sFromFolderFullNameRaw) && '' !== sFromFolderFullNameRaw && Utils.isArray(aUids))
			{
				require('App/User').moveMessagesToFolder(sFromFolderFullNameRaw, aUids, oToFolder.fullNameRaw, bCopy);
			}
		}
	};

	FolderListMailBoxUserView.prototype.composeClick = function ()
	{
		kn.showScreenPopup(require('View/Popup/Compose'));
	};

	FolderListMailBoxUserView.prototype.createFolder = function ()
	{
		kn.showScreenPopup(require('View/Popup/FolderCreate'));
	};

	FolderListMailBoxUserView.prototype.configureFolders = function ()
	{
		kn.setHash(Links.settings('folders'));
	};

	FolderListMailBoxUserView.prototype.contactsClick = function ()
	{
		if (this.allowContacts)
		{
			kn.showScreenPopup(require('View/Popup/Contacts'));
		}
	};

	module.exports = FolderListMailBoxUserView;

}());
