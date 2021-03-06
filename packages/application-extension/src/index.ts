// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  JupyterLab, JupyterLabPlugin, ILayoutRestorer, IRouter, LayoutRestorer, Router
} from '@jupyterlab/application';

import {
  Dialog, ICommandPalette, showDialog
} from '@jupyterlab/apputils';

import {
  IStateDB, PageConfig, URLExt
} from '@jupyterlab/coreutils';

import {
  h
} from '@phosphor/virtualdom';


/**
 * The command IDs used by the application plugin.
 */
namespace CommandIDs {
  export
  const activateNextTab: string = 'application:activate-next-tab';

  export
  const activatePreviousTab: string = 'application:activate-previous-tab';

  export
  const closeAll: string = 'application:close-all';

  export
  const setMode: string = 'application:set-mode';

  export
  const toggleMode: string = 'application:toggle-mode';

  export
  const toggleLeftArea: string = 'application:toggle-left-area';

  export
  const toggleRightArea: string = 'application:toggle-right-area';

  export
  const tree: string = 'router:tree';

  export
  const url: string = 'router:tree-url';
}


/**
 * The main extension.
 */
const main: JupyterLabPlugin<void> = {
  id: '@jupyterlab/application-extension:main',
  requires: [ICommandPalette],
  activate: (app: JupyterLab, palette: ICommandPalette) => {
    addCommands(app, palette);

    // If the currently active widget changes,
    // trigger a refresh of the commands.
    app.shell.currentChanged.connect(() => {
      app.commands.notifyCommandChanged(CommandIDs.closeAll);
    });

    let builder = app.serviceManager.builder;

    let doBuild = () => {
      return builder.build().then(() => {
        return showDialog({
          title: 'Build Complete',
          body: 'Build successfully completed, reload page?',
          buttons: [Dialog.cancelButton(),
                    Dialog.warnButton({ label: 'RELOAD' })]
        });
      }).then(result => {
        if (result.button.accept) {
          location.reload();
        }
      }).catch(err => {
        showDialog({
          title: 'Build Failed',
          body: h.pre(err.message)
        });
      });
    };

    if (builder.isAvailable && builder.shouldCheck) {
      builder.getStatus().then(response => {
        if (response.status === 'building') {
          return doBuild();
        }
        if (response.status !== 'needed') {
          return;
        }
        let body = h.div(
          h.p(
            'JupyterLab build is suggested:',
            h.br(),
            h.pre(response.message)
          )
        );
        showDialog({
          title: 'Build Recommended',
          body,
          buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'BUILD' })]
        }).then(result => {
          if (result.button.accept) {
            return doBuild();
          }
        });
      });
    }

    const message = 'Are you sure you want to exit JupyterLab?\n' +
                    'Any unsaved changes will be lost.';

    // The spec for the `beforeunload` event is implemented differently by
    // the different browser vendors. Consequently, the `event.returnValue`
    // attribute needs to set in addition to a return value being returned.
    // For more information, see:
    // https://developer.mozilla.org/en/docs/Web/Events/beforeunload
    window.addEventListener('beforeunload', event => {
      if (app.isDirty) {
        return (event as any).returnValue = message;
      }
    });
  },
  autoStart: true
};


/**
 * The default layout restorer provider.
 */
const layout: JupyterLabPlugin<ILayoutRestorer> = {
  id: '@jupyterlab/application-extension:layout',
  requires: [IStateDB],
  activate: (app: JupyterLab, state: IStateDB) => {
    const first = app.started;
    const registry = app.commands;
    const restorer = new LayoutRestorer({ first, registry, state });

    restorer.fetch().then(saved => {
      app.shell.restoreLayout(saved);
      app.shell.layoutModified.connect(() => {
        restorer.save(app.shell.saveLayout());
      });
    });

    return restorer;
  },
  autoStart: true,
  provides: ILayoutRestorer
};


/**
 * The default URL router provider.
 */
const router: JupyterLabPlugin<IRouter> = {
  id: '@jupyterlab/application-extension:router',
  activate: (app: JupyterLab) => {
    const { commands } = app;
    const base = URLExt.join(
      PageConfig.getBaseUrl(),
      PageConfig.getOption('pageUrl')
    );
    const tree = PageConfig.getTreeUrl();
    const router = new Router({ base, commands });

    commands.addCommand(CommandIDs.tree, {
      execute: (args: IRouter.ICommandArgs) => {
        const path = (args.path as string).replace('/tree', '');

        // Change the URL back to the base application URL.
        window.history.replaceState({ }, '', base);

        return commands.execute('filebrowser:navigate-main', { path });
      }
    });

    commands.addCommand(CommandIDs.url, {
      execute: args => URLExt.join(tree, (args.path as string))
    });

    app.restored.then(() => { router.route(window.location.href); });
    router.register(/^\/tree\/.+/, CommandIDs.tree);

    return router;
  },
  autoStart: true,
  provides: IRouter
};


/**
 * The default URL not found extension.
 */
const notfound: JupyterLabPlugin<void> = {
  id: '@jupyterlab/application-extension:notfound',
  activate: (app: JupyterLab) => {
    const bad = PageConfig.getOption('notFoundUrl');

    if (!bad) {
      return;
    }

    const base = URLExt.join(
      PageConfig.getBaseUrl(),
      PageConfig.getOption('pageUrl')
    );

    // Change the URL back to the base application URL.
    window.history.replaceState({ }, '', base);

    showDialog({
      title: 'Path Not Found',
      body: `The path: ${bad} was not found. JupyterLab redirected to: ${base}`,
      buttons: [Dialog.okButton()]
    });
  },
  autoStart: true
};


/**
 * Add the main application commands.
 */
function addCommands(app: JupyterLab, palette: ICommandPalette): void {
  const category = 'Main Area';
  let command = CommandIDs.activateNextTab;

  app.commands.addCommand(command, {
    label: 'Activate Next Tab',
    execute: () => { app.shell.activateNextTab(); }
  });
  palette.addItem({ command, category });

  command = CommandIDs.activatePreviousTab;
  app.commands.addCommand(command, {
    label: 'Activate Previous Tab',
    execute: () => { app.shell.activatePreviousTab(); }
  });
  palette.addItem({ command, category });

  command = CommandIDs.closeAll;
  app.commands.addCommand(command, {
    label: 'Close All Widgets',
    execute: () => { app.shell.closeAll(); }
  });
  palette.addItem({ command, category });

  command = CommandIDs.toggleLeftArea;
  app.commands.addCommand(command, {
    label: 'Show Left Area',
    execute: () => {
      if (app.shell.leftCollapsed) {
        app.shell.expandLeft();
      } else {
        app.shell.collapseLeft();
      }
    },
    isToggled: () => !app.shell.leftCollapsed,
    isVisible: () => !app.shell.isEmpty('left')
  });
  palette.addItem({ command, category });

  command = CommandIDs.toggleRightArea;
  app.commands.addCommand(command, {
    label: 'Show Right Area',
    execute: () => {
      if (app.shell.rightCollapsed) {
        app.shell.expandRight();
      } else {
        app.shell.collapseRight();
      }
    },
    isToggled: () => !app.shell.rightCollapsed,
    isVisible: () => !app.shell.isEmpty('right')
  });
  palette.addItem({ command, category });

  command = CommandIDs.setMode;
  app.commands.addCommand(command, {
    isVisible: args => {
      const mode = args['mode'] as string;
      return mode === 'single-document' || mode === 'multiple-document';
    },
    execute: args => {
      const mode = args['mode'] as string;
      if (mode === 'single-document' || mode === 'multiple-document') {
        app.shell.mode = mode;
        return;
      }
      throw new Error(`Unsupported application shell mode: ${mode}`);
    }
  });

  command = CommandIDs.toggleMode;
  app.commands.addCommand(command, {
    label: args => args['isPalette'] ?
      'Toggle Single-Document Mode' : 'Single-Document Mode',
    isToggled: () => app.shell.mode === 'single-document',
    execute: () => {
      const args = app.shell.mode === 'multiple-document' ?
        { mode: 'single-document' } : { mode: 'multiple-document' };
      return app.commands.execute(CommandIDs.setMode, args);
    }
  });
  palette.addItem({ command, category, args: { 'isPalette': true } });
}


/**
 * Export the plugins as default.
 */
const plugins: JupyterLabPlugin<any>[] = [main, layout, router, notfound];

export default plugins;
