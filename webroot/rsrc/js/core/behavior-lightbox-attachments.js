/**
 * @provides javelin-behavior-lightbox-attachments
 * @requires javelin-behavior
 *           javelin-stratcom
 *           javelin-dom
 *           javelin-mask
 *           javelin-util
 *           phuix-icon-view
 *           phabricator-busy
 */

JX.behavior('lightbox-attachments', function (config) {

  var lightbox     = null;
  var prev         = null;
  var next         = null;
  var shown        = false;
  var downloadForm = JX.$H(config.downloadForm).getFragment().firstChild;
  var lightbox_id  = config.lightbox_id;

  function _toggleComment(e) {
    e.kill();
    shown = !shown;
    JX.DOM.alterClass(JX.$(lightbox_id), 'comment-panel-open', shown);
  }

  function markCommentsLoading(loading) {
    var frame = JX.$('lightbox-comment-frame');
    JX.DOM.alterClass(frame, 'loading', loading);
  }

  function onLoadCommentsResponse(r) {
    var frame = JX.$('lightbox-comment-frame');
    JX.DOM.setContent(frame, JX.$H(r));
    markCommentsLoading(false);
  }

  function loadComments(phid) {
    markCommentsLoading(true);
    var uri = '/file/thread/' + phid + '/';
    new JX.Workflow(uri)
      .setHandler(onLoadCommentsResponse)
      .start();
  }

  function loadLightBox(e) {
    if (!e.isNormalClick()) {
      return;
    }

    e.kill();

    var links = JX.DOM.scry(document, 'a', 'lightboxable');
    var phids = {};
    var data;
    for (var i = 0; i < links.length; i++) {
      data = JX.Stratcom.getData(links[i]);
      phids[data.phid] = links[i];
    }

    // Now that we have the big picture phid situation sorted out, figure
    // out how the actual node the user clicks fits into that big picture
    // and build some pretty UI to show the attachment.
    var target      = e.getNode('lightboxable');
    var target_data = JX.Stratcom.getData(target);
    var total       = JX.keys(phids).length;
    var current     = 1;
    var past_target = false;
    for (var phid in phids) {
      if (past_target) {
        next = phids[phid];
        break;
      } else if (phid == target_data.phid) {
        past_target = true;
      } else {
        prev = phids[phid];
        current++;
      }
    }

    var img_uri = '';
    var extra_status = '';
    var name_element = '';
    // for now, this conditional is always true
    // revisit if / when we decide to add non-images to lightbox view
    if (target_data.viewable) {
      img_uri = target_data.uri;
    } else {
      img_uri = config.defaultImageUri;
      extra_status = ' Image may not be representative of actual attachment.';
      name_element =
        JX.$N('div',
          {
            className : 'attachment-name'
          },
          target_data.name
        );
    }

    var alt_name = '';
    if (typeof target_data.name != 'undefined') {
      alt_name = target_data.name;
    }

    var img =
      JX.$N('img',
        {
          className : 'loading',
          alt : alt_name
        }
      );

    var imgFrame =
      JX.$N('div',
        {
          className : 'lightbox-image-frame',
        },
        img
      );

    var commentFrame =
      JX.$N('div',
        {
          className : 'lightbox-comment-frame',
          id : 'lightbox-comment-frame'
        }
      );

    var commentClass = (shown) ? 'comment-panel-open' : '';
    lightbox =
      JX.$N('div',
        {
          className : 'lightbox-attachment ' + commentClass,
          sigil : 'lightbox-attachment',
          id : lightbox_id
        },
        [imgFrame, commentFrame]
      );

    var monogram = JX.$N('strong', {}, target_data.monogram);
    var m_url = JX.$N('a', { href :  '/' + target_data.monogram }, monogram);
    var statusSpan =
      JX.$N('span',
        {
          className: 'lightbox-status-txt'
        },
        [
          m_url,
          ' Image ' + current + ' of ' + total + '.' + extra_status
        ]
      );

    var downloadSpan =
      JX.$N('span',
        {
          className : 'lightbox-download'
        }
      );

    var commentIcon = new JX.PHUIXIconView()
      .setIcon('fa-comment-o')
      .getNode();
    var commentButton =
      JX.$N('a',
        {
          className : 'lightbox-comment button grey has-icon',
          href : '#',
          sigil : 'lightbox-comment'
        },
        [commentIcon, 'Comment']
      );
    var closeButton =
      JX.$N('a',
        {
          className : 'lightbox-close button grey',
          href : '#'
        },
        'Close');
    var statusHTML =
      JX.$N('div',
        {
          className : 'lightbox-status'
        },
       [statusSpan, closeButton, commentButton, downloadSpan]
      );
    JX.DOM.appendContent(lightbox, statusHTML);
    JX.DOM.appendContent(lightbox, name_element);
    JX.DOM.listen(closeButton, 'click', null, closeLightBox);

    var leftIcon = '';
    if (next) {
      var r_icon = new JX.PHUIXIconView()
        .setIcon('fa-angle-right')
        .setColor('lightgreytext')
        .getNode();
      leftIcon =
        JX.$N('a',
          {
            className : 'lightbox-right',
            href : '#'
          },
          r_icon
        );
      JX.DOM.listen(leftIcon,
                    'click',
                    null,
                    JX.bind(null, loadAnotherLightBox, next)
                   );
    }
    JX.DOM.appendContent(lightbox, leftIcon);
    var rightIcon = '';
    if (prev) {
      var l_icon = new JX.PHUIXIconView()
        .setIcon('fa-angle-left')
        .setColor('lightgreytext')
        .getNode();
      rightIcon =
        JX.$N('a',
          {
            className : 'lightbox-left',
            href : '#'
          },
          l_icon
        );
      JX.DOM.listen(rightIcon,
                    'click',
                    null,
                    JX.bind(null, loadAnotherLightBox, prev)
                   );
    }
    JX.DOM.appendContent(lightbox, rightIcon);

    JX.DOM.alterClass(document.body, 'lightbox-attached', true);
    JX.Mask.show('jx-dark-mask');

    downloadForm.action = target_data.dUri;
    downloadSpan.appendChild(downloadForm);

    document.body.appendChild(lightbox);

    JX.Busy.start();
    img.onload = function() {
      JX.DOM.alterClass(img, 'loading', false);
      JX.Busy.done();
    };

    img.src = img_uri;
    loadComments(target_data.phid);
  }

  // TODO - make this work with KeyboardShortcut, which means
  // making an uninstall / de-register for KeyboardShortcut
  function lightBoxHandleKeyDown(e) {
    if (!lightbox) {
      return;
    }
    var raw = e.getRawEvent();
    if (raw.altKey || raw.ctrlKey || raw.metaKey) {
      return;
    }
    if (JX.Stratcom.pass()) {
      return;
    }

    var handler = JX.bag;
    switch (e.getSpecialKey()) {
      case 'esc':
        handler = closeLightBox;
        break;
      case 'right':
      if (next) {
          handler = JX.bind(null, loadAnotherLightBox, next);
        }
        break;
      case 'left':
        if (prev) {
          handler = JX.bind(null, loadAnotherLightBox, prev);
        }
        break;
    }
    return handler(e);
  }

  function closeLightBox(e) {
    if (!lightbox) {
      return;
    }
    e.prevent();
    JX.DOM.remove(lightbox);
    JX.Mask.hide();
    JX.DOM.alterClass(document.body, 'lightbox-attached', false);
    lightbox = null;
    prev     = null;
    next     = null;
  }

  function loadAnotherLightBox(el, e) {
    if (!el) {
      return;
    }
    e.prevent();
    closeLightBox(e);
    el.click();
  }

  JX.Stratcom.listen(
    'click',
    ['lightboxable'],
    loadLightBox);

  JX.Stratcom.listen(
    'keydown',
    null,
    lightBoxHandleKeyDown);

  // When the user clicks the background, close the lightbox.
  JX.Stratcom.listen(
    'click',
    'lightbox-attachment',
    function (e) {
      if (!lightbox) {
        return;
      }
      if (e.getTarget() != e.getNode('lightbox-attachment')) {
        // Don't close if they clicked some other element, like the image
        // itself or the next/previous arrows.
        return;
      }
      closeLightBox(e);
      e.kill();
    });

  JX.Stratcom.listen(
    'click',
    'lightbox-comment',
  _toggleComment);

  var _sendMessage = function(e) {
    e.kill();
    var form = e.getNode('tag:form');
    JX.Workflow.newFromForm(form)
      .setHandler(onLoadCommentsResponse)
      .start();
  };

  JX.Stratcom.listen(
    ['submit', 'didSyntheticSubmit'],
    'lightbox-comment-form',
    _sendMessage);

});
