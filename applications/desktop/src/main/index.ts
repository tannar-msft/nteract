import { ConfigurationOption, defineConfigOption } from "@nteract/mythic-configuration";
import { setConfigFile } from "@nteract/mythic-configuration/src/backends/filesystem";
import { closeWindow, electronBackend, setWindowingBackend, showWindow } from "@nteract/mythic-windowing";
import { KernelspecInfo } from "@nteract/types";
import { app, BrowserWindow, dialog, Event, ipcMain as ipc, IpcMainEvent, Menu, nativeTheme, Tray } from "electron";
import initContextMenu from "electron-context-menu";
import * as log from "electron-log";
import { existsSync } from "fs";
import { join, resolve } from "path";
import { fromEvent, Observable, Subscriber, zip } from "rxjs";
import { buffer, first, last, skipUntil, takeUntil } from "rxjs/operators";
import yargs from "yargs/yargs";
import { QUITTING_STATE_NOT_STARTED, QUITTING_STATE_QUITTING, setQuittingState } from "./actions";
import { initAutoUpdater } from "./auto-updater";
import { defaultKernel } from "./config-options";
import { bestKernelObservable, kernelSpecs$ } from "./kernel-specs";
import { launch, launchNewNotebook } from "./launch";
import { loadFullMenu, loadTrayMenu } from "./menu";
import prepareEnv from "./prepare-env";
import configureStore from "./store";

import installExtension, { REDUX_DEVTOOLS, REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';

// FIXME: Needed to load zeromq for now, but deprecated and to be removed in
//        electron@11. Need to figure out how to get a version of zmq that
//        complies with the new requirements for native modules.
//        See also: https://github.com/electron/electron/issues/18397
app.allowRendererProcessReuse = false;

const store = configureStore(undefined);

// HACK: The main process store should not be stored in a global.
(global as any).store = store;

const argv = yargs()
  .version((() => require("./../../package.json").version)())
  .usage("Usage: nteract <notebooks> [options]")
  .example("nteract notebook1.ipynb notebook2.ipynb", "Open notebooks")
  .example("nteract --kernel javascript", "Launch a kernel")
  .describe("kernel", "Launch a kernel")
  .alias("k", "kernel")
  .alias("v", "version")
  .alias("h", "help")
  .describe("verbose", "Display debug information")
  .help("help")
  .parse(process.argv.slice(1));

log.info("args", argv);

const notebooks = argv._.filter((x) => /(.ipynb)$/.test(x));

ipc.on("transfer-config-options-to-main",
  (_event: any, options: ConfigurationOption[]) => {
    options.forEach(each => defineConfigOption(each));
  });

ipc.on("new-kernel", (_event: any, k: KernelspecInfo) => {
  launchNewNotebook(null, k);
});

ipc.on("open-notebook", (_event: any, filename: string) => {
  launch(resolve(filename));
});

ipc.on("reload", (event: IpcMainEvent) => {
  event.sender.reload();
  event.returnValue = null;
});

ipc.on("show-message-box", async (event: IpcMainEvent, arg: any) => {
  const response = await dialog.showMessageBox(arg);
  event.sender.send("show-message-box-response", response);
});

ipc.on("kernel_specs_request", event =>
  kernelSpecs$
    .pipe(last())
    .subscribe(specs => event.reply("kernel_specs_reply", specs))
);

app.on("ready", initAutoUpdater);

const electronReady$ = new Observable((observer) => {
  (app as any).on("ready", (launchInfo: object) => observer.next(launchInfo));
});
const windowReady$ = fromEvent(ipc, "react-ready");

const fullAppReady$ = zip(electronReady$, prepareEnv).pipe(first());

const jupyterConfigDir = join(app.getPath("home"), ".jupyter");
const nteractConfigFilename = join(jupyterConfigDir, "nteract.json");

store.dispatch(setConfigFile(nteractConfigFilename));
store.dispatch(setWindowingBackend.create(electronBackend));

const appAndKernelSpecsReady$ = zip(
  fullAppReady$,
  windowReady$,
  kernelSpecs$,
);

electronReady$
  .pipe(takeUntil(appAndKernelSpecsReady$))
  .subscribe(
    () => store.dispatch(
      showWindow.create({
        id: "splash",
        kind: "splash",
        width: 565,
        height: 233,
        path: join(__dirname, "..", "static", "splash.html")
      })
    ),
    (err) => console.error(err),
    () => store.dispatch(
      closeWindow.create("splash")
    )
  );

app.on("before-quit", (e) => {
  // We use Electron's before-quit to give us a hook to into full app quit events,
  // such as Command+Q on macOS.

  // This is broken on Windows due to a bug in Electron; see #3549.
  // For most Windows workflows the user will be closing individual notebook windows directly,
  // so we just avoid this code path for now.
  if (process.platform === "win32") {
    return;
  }

  const windows = BrowserWindow.getAllWindows();
  if (
    // `win.close()` teardown is async, so `isVisible` is more reliable, see #3656
    windows.filter((win) => win.isVisible()).length > 0 &&
    store.getState().quittingState === QUITTING_STATE_NOT_STARTED
  ) {
    e.preventDefault();
    store.dispatch(setQuittingState(QUITTING_STATE_QUITTING));

    // Trigger each windows' closeNotebookEpic. If and when all windows are closed,
    // the window-all-closed event will fire and we will complete the quit action.
    windows.forEach((win) => win.close());
  }
});

const windowAllClosed = new Observable((observer) => {
  app.on("window-all-closed", (event: Event) => observer.next(event));
});

windowAllClosed.pipe(skipUntil(appAndKernelSpecsReady$)).subscribe(() => {
  // On macOS:
  // - If user manually closed the last window, we want to keep the app and
  //   menu bar active.
  // - If the window was closed programmatically as part of a quit, and not
  //   canceled during notebook shutdown, then we proceed w/ the quit.
  // All other platforms:
  // - Quit when last window closed.
  if (
    process.platform !== "darwin" ||
    store.getState().quittingState === QUITTING_STATE_QUITTING
  ) {
    app.quit();
  }
});

ipc.on("close-notebook-canceled", () => {
  // User canceled, so interpret that as cancelling any in-flight app-wide quit
  store.dispatch(setQuittingState(QUITTING_STATE_NOT_STARTED));
});

const openFile$ = new Observable(
  (observer: Subscriber<{ filename: string; event: Event }>) => {
    const eventName = "open-file";

    const handler = (event: Event, filename: string) => {
      observer.next({
        event,
        filename
      });
    };
    app.on(eventName, handler);

    return () => app.removeListener(eventName, handler);
  }
);

function openFileFromEvent({
  event,
  filename
}: {
  event: Event;
  filename: string;
}) {
  event.preventDefault();
  launch(resolve(filename));
}

// Since we can't launch until app is ready
// and macOS will send the open-file events early,
// buffer those that come early.
openFile$
  .pipe(buffer(fullAppReady$), first())
  .subscribe((buffer: Array<{ filename: string; event: Event }>) => {
    // Form an array of open-file events from before app-ready
    // Should only be the first
    // Now we can choose whether to open the default notebook
    // based on if arguments went through argv or through open-file events

    const bestKernel$ =
      bestKernelObservable(
        argv.kernel as string,
        defaultKernel(store.getState()),
      );

    if (notebooks.length <= 0 && buffer.length <= 0) {
      bestKernel$.subscribe(
        spec => launchNewNotebook(null, spec),
      );
    } else {
      notebooks.forEach((f) => {
        if (existsSync(resolve(f))) {
          try {
            launch(resolve(f));
          } catch (e) {
            log.error(e);
            console.error(e);
          }
        } else {
          log.info(`notebook ${f} not found, launching as empty notebook`);
          bestKernel$.subscribe(
            spec => launchNewNotebook(f, spec),
          );
        }
      });
    }
    buffer.forEach(openFileFromEvent);
  });

// All open file events after app is ready
openFile$
  .pipe(skipUntil(fullAppReady$))
  .subscribe(openFileFromEvent);

fullAppReady$.subscribe(() => {
  // Setup right-click context menu for all BrowserWindows
  initContextMenu();
});

appAndKernelSpecsReady$.subscribe(() => {
  const logo = (
    nativeTheme.shouldUseDarkColors ||
    process.platform === "darwin" // Macs support logo templates and selecting the right color automatically
  ) ? "logoTemplate" : "logoWhite";

  const tray = new Tray(join(__dirname, "..", "static", `${logo}.png`));

  Menu.setApplicationMenu(loadFullMenu());
  tray.setContextMenu(loadTrayMenu());
});

app.on('ready', () => {
  installExtension([REDUX_DEVTOOLS, REACT_DEVELOPER_TOOLS], { loadExtensionOptions: { allowFileAccess: true } })
      .then((name) => console.log(`Added Extension:  ${name}`))
      .catch((err) => console.log('An error occurred: ', err));
});
