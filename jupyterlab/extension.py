# coding: utf-8
"""A tornado based Jupyter lab server."""

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

#-----------------------------------------------------------------------------
# Module globals
#-----------------------------------------------------------------------------
import os

DEV_NOTE = """You're running JupyterLab from source.
If you're working on the TypeScript sources of JupyterLab, try running

    jupyter lab --dev-mode --watch


to have the system incrementally watch and build JupyterLab for you, as you
make changes.
"""


CORE_NOTE = """
Running the core application with no additional extensions or settings
"""


def load_jupyter_server_extension(nbapp):
    """Load the JupyterLab server extension.
    """
    # Delay imports to speed up jlpmapp
    from jupyterlab_launcher import add_handlers, LabConfig
    from notebook.utils import url_path_join as ujoin, url_escape
    from tornado.ioloop import IOLoop
    from .build_handler import build_path, Builder, BuildHandler
    from .commands import (
        get_app_dir, get_user_settings_dir, watch, ensure_dev, watch_dev,
        pjoin, DEV_DIR, HERE, get_app_info, ensure_core
    )
    from ._version import __version__

    web_app = nbapp.web_app
    logger = nbapp.log
    config = LabConfig()
    app_dir = getattr(nbapp, 'app_dir', get_app_dir())

    # Print messages.
    logger.info('JupyterLab beta preview extension loaded from %s' % HERE)
    logger.info('JupyterLab application directory is %s' % app_dir)

    config.app_name = 'JupyterLab Beta'
    config.app_namespace = 'jupyterlab'
    config.page_url = '/lab'
    config.cache_files = True

    # Check for core mode.
    core_mode = False
    if getattr(nbapp, 'core_mode', False) or app_dir.startswith(HERE):
        core_mode = True
        logger.info('Running JupyterLab in core mode')

    # Check for dev mode.
    dev_mode = False
    if getattr(nbapp, 'dev_mode', False) or app_dir.startswith(DEV_DIR):
        dev_mode = True
        logger.info('Running JupyterLab in dev mode')

    # Check for watch.
    watch_mode = getattr(nbapp, 'watch', False)

    if watch_mode and core_mode:
        logger.warn('Cannot watch in core mode, did you mean --dev-mode?')
        watch_mode = False

    if core_mode and dev_mode:
        logger.warn('Conflicting modes, choosing dev_mode over core_mode')
        core_mode = False

    page_config = web_app.settings.setdefault('page_config_data', dict())
    page_config['buildAvailable'] = not core_mode and not dev_mode
    page_config['buildCheck'] = not core_mode and not dev_mode
    page_config['token'] = nbapp.token
    page_config['devMode'] = dev_mode

    if nbapp.file_to_run:
        relpath = os.path.relpath(nbapp.file_to_run, nbapp.notebook_dir)
        uri = url_escape(ujoin('/lab/tree', *relpath.split(os.sep)))
        nbapp.default_url = uri
        nbapp.file_to_run = ''

    if core_mode:
        app_dir = HERE
        logger.info(CORE_NOTE.strip())
        ensure_core(logger)

    elif dev_mode:
        app_dir = DEV_DIR
        ensure_dev(logger)
        if not watch_mode:
            logger.info(DEV_NOTE)

    config.app_settings_dir = pjoin(app_dir, 'settings')
    config.schemas_dir = pjoin(app_dir, 'schemas')
    config.themes_dir = pjoin(app_dir, 'themes')
    info = get_app_info(app_dir)
    config.app_version = info['version']
    public_url = info['publicUrl']
    if public_url:
        config.public_url = public_url
    else:
        config.static_dir = pjoin(app_dir, 'static')

    config.user_settings_dir = get_user_settings_dir()
    config.templates_dir = pjoin(app_dir, 'static')

    if watch_mode:
        logger.info('Starting JupyterLab watch mode...')

        # Set the ioloop in case the watch fails.
        nbapp.ioloop = IOLoop.current()
        if dev_mode:
            watch_dev(logger)
        else:
            watch(app_dir, logger)
            page_config['buildAvailable'] = False

        config.cache_files = False

    base_url = web_app.settings['base_url']
    build_url = ujoin(base_url, build_path)
    builder = Builder(logger, core_mode, app_dir)
    build_handler = (build_url, BuildHandler, {'builder': builder})

    # Must add before the launcher handlers to avoid shadowing.
    web_app.add_handlers(".*$", [build_handler])

    add_handlers(web_app, config)
