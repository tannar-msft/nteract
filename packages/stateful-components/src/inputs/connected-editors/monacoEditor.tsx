import { connect } from "react-redux";

import { selectors, AppState, ContentRef } from "@nteract/core";
import * as monaco from "@nteract/monaco-editor";

import { userTheme } from "../../config-options";
import { Channels } from "@nteract/messaging";
import { createConfigCollection } from "@nteract/mythic-configuration";

const monacoConfig = createConfigCollection({
  key: "monaco",
});

interface ComponentProps {
  id: string;
  contentRef: ContentRef;
  editorType: string;
  readOnly?: boolean;
  value: string;
  channels: Channels;
  editorFocused: boolean;
}

function getMonacoTheme(theme?: string) : string {
  if (typeof theme === "string") {
    switch (theme) {
      case "dark":
        return monaco.DarkThemeName;
      default:
        return monaco.LightThemeName;
    }
  } else {
    return monaco.LightThemeName;
  }
}

const makeMapStateToProps = (initialState: AppState, ownProps: ComponentProps) => {
  const { id, contentRef } = ownProps;
  function mapStateToProps(state: any) {
    const model = selectors.model(state, { contentRef });
    const theme = userTheme(state) || "vs";
    let wordWrap:monaco.editor.IEditorOptions["wordWrap"] = "on";
    let editorMode: string = monaco.Mode.raw;
    if (model && model.type === "notebook") {
      const cell = selectors.notebook.cellById(model, { id });
      if (cell) {
        // Bring all changes to the options based on cell type 
        switch (cell.cell_type) {
          case "markdown":
            editorMode = monaco.Mode.markdown;
            break;
          case "code": {
            wordWrap = "off";
            const kernelRef = model.kernelRef;
            const kernel = kernelRef ? state.core.entities.kernels.byRef.get(kernelRef) : null;

            // otherwise assume we can use what's in the document
            const mode =
                kernel && kernel.info
                ? kernel.info.codemirrorMode
                : selectors.notebook.codeMirrorMode(model);
            editorMode = monaco.mapCodeMirrorModeToMonaco(mode);
            break;
          }
          default:
            editorMode = monaco.Mode.raw;
            break;
          }
        }
      }
    const defaultEditorOptions: monaco.editor.IEditorOptions = {
      wordWrap,
      autoClosingBrackets: "never"
    }
    const options = {
      ...defaultEditorOptions,
      ...monacoConfig(state as any),
    }

    return {
      language: editorMode,
      theme : getMonacoTheme(theme),
      enableCompletion: true,
      shouldRegisterDefaultCompletion: true,
      indentSize: 4,
      lineNumbers: false,
      tabSize: 4,
      options
    };
  }
  return mapStateToProps;
};

export default connect(makeMapStateToProps)(monaco.default);