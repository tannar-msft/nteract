import { ofMessageType, JupyterMessage } from "@nteract/messaging";
import { commOpenAction, appendOutput } from "@nteract/actions";
import selectors from "@nteract/selectors";
import {
  DocumentRecordProps,
  EmptyModelRecordProps,
  FileModelRecordProps,
  DirectoryModelRecordProps,
  ContentRef,
  RemoteKernelProps,
  LocalKernelProps
} from "@nteract/types";
import { of } from "rxjs";
import { filter, switchMap } from "rxjs/operators";

import { RecordOf } from "immutable";

/**
 * Listen for comm_open messages from the kernel that are associated
 * with models that will not be rendered on the page.
 *
 * Note: this is not an ideal solution but we need to do this
 * so that we can keep the WidgetManager contextualized to the
 * WidgetDisplay as opposed to at the top-level.
 */
export const ipywidgetsModel$ = (
  kernel: LocalKernelProps | RemoteKernelProps,
  model:
    | RecordOf<DocumentRecordProps>
    | RecordOf<EmptyModelRecordProps>
    | RecordOf<FileModelRecordProps>
    | RecordOf<DirectoryModelRecordProps>
    | null,
  contentRef: ContentRef
) =>
  kernel.channels.pipe(
    ofMessageType("comm_open"),
    filter((msg: JupyterMessage) => {
      if (msg.content.data.state._model_name === "LinkModel") {
        return true;
      }
      return false;
    }),
    switchMap((msg: JupyterMessage) =>
      of(
        commOpenAction(msg),
        /**
         * If the content we are running under is a notebook,
         * then append a mock output for the linkModel to the
         * notebook.
         */
        model && model.get("type", null) === "notebook"
          ? appendOutput({
              /**
               * Append the output to the currently focused cell.
               *
               * Ideally, we would append the output to the cell
               * that the output was generated in. However, we
               * don't currently do any associated between the source
               * of execution and the follow-on actions.
               */
              id:
                selectors.notebook.cellFocused(model) ||
                selectors.notebook.cellOrder(model).first(),
              contentRef,
              output: {
                output_type: "display_data",
                data: {
                  "application/vnd.jupyter.widget-view+json": {
                    model_id: msg.content.comm_id,
                    version_major: 2,
                    version_minor: 0
                  }
                },
                metadata: {},
                transient: {}
              }
            })
          : null
      )
    )
  );
