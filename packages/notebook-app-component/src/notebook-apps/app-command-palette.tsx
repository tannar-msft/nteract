import React from "react";

import {
  CommandButtonRow,
  CommandPalette as Palette,
  Icons,
} from "@nteract/presentational-components";
import os from "os";
import { GlobalHotKeys } from "react-hotkeys";

import { ContentRef } from "@nteract/core";
import {
  CommandContainer,
  CommandContext,
  CommandDispatchProps,
} from "@nteract/stateful-components";

const isMac = os.platform() === "darwin";
const commandOrControl = isMac ? "⌘" : "Ctrl";

const actions = {
  HIDE_MENU: "HIDE_MENU",
  RUN_CELL: "RUN_CELL",
  CREATE_CELL_ABOVE: "CREATE_CELL_ABOVE",
  CREATE_CELL_BELOW: "CREATE_CELL_BELOW",
  CONVERT_TO_MARKDOWN: "CONVERT_TO_MARKDOWN",
  HIDE_OUTPUT: "HIDE_OUTPUT",
  HIDE_INPUT: "HIDE_INPUT",
};

interface Filter {
  id: string;
  icon: React.ReactNode;
  onClick: () => void;
  text: string;
  displayShortcut: string[];
  shortcut: string | string[];
}

function getFilters(handlers: any): Filter[] {
  return [
    {
      id: actions.RUN_CELL,
      icon: <Icons.Play />,
      onClick: () => {
        handlers[actions.RUN_CELL]();
      },
      text: "Run Cell",
      displayShortcut: [commandOrControl, "Enter"],
      shortcut: ["ctrl+enter", "meta+enter"],
    },
    {
      id: actions.CREATE_CELL_BELOW,
      icon: <Icons.AddCell />,
      onClick: () => {
        handlers[actions.CREATE_CELL_BELOW]();
      },
      displayShortcut: [commandOrControl, "Shift", "B"],
      text: "Add Cell Below",
      shortcut: "ctrl+shift+b",
    },
    {
      id: actions.CREATE_CELL_ABOVE,
      icon: <Icons.AddCell below={false} />,
      onClick: () => {
        handlers[actions.CREATE_CELL_ABOVE]();
      },
      displayShortcut: [commandOrControl, "Shift", "A"],
      text: "Add Cell Above",
      shortcut: "ctrl+shift+a",
    },
    {
      id: actions.CONVERT_TO_MARKDOWN,
      icon: <Icons.Markdown />,
      onClick: () => {
        handlers[actions.CONVERT_TO_MARKDOWN]();
      },
      displayShortcut: [commandOrControl, "Shift", "M"],
      text: "Convert to Markdown",
      shortcut: ["ctrl+shift+m"],
    },
    {
      id: actions.HIDE_OUTPUT,
      icon: <Icons.Eye />,
      onClick: () => {
        handlers[actions.HIDE_OUTPUT]();
      },
      displayShortcut: ["Shift", "O"],
      text: "Hide Output",
      shortcut: ["shift+o"],
    },
    {
      id: actions.HIDE_INPUT,
      icon: <Icons.Eye />,
      onClick: () => {
        handlers[actions.HIDE_INPUT]();
      },
      displayShortcut: ["Shift", "I"],
      text: "Hide Input",
      shortcut: ["shift+i"],
    },
  ];
}

function getHandlers({
  restartAndRun,
  addCellAbove,
  addCellBelow,
  hideOutput,
  hideInput,
  onToggleVisibility,
  convertToMarkdown,
}: Props) {
  const handlers = {
    RUN_CELL: () => {
      restartAndRun();
      onToggleVisibility();
    },
    CREATE_CELL_ABOVE: () => {
      addCellAbove();
      onToggleVisibility();
    },
    CREATE_CELL_BELOW: () => {
      addCellBelow();
      onToggleVisibility();
    },
    CONVERT_TO_MARKDOWN: () => {
      convertToMarkdown();
      onToggleVisibility();
    },
    HIDE_OUTPUT: () => {
      hideOutput();
      onToggleVisibility();
    },
    HIDE_INPUT: () => {
      hideInput();
      onToggleVisibility();
    },
  };

  return handlers;
}

function getKeymap(filters: Filter[]) {
  return filters.reduce(
    (acc, next) => ({ ...acc, [next.id]: next.shortcut }),
    {}
  );
}

interface ComponentProps {
  contentRef: ContentRef;
  isVisible: boolean;
  onToggleVisibility: () => void;
}

type Props = CommandDispatchProps & ComponentProps;

interface State {
  filter: string;
}
class CommandPalette extends React.PureComponent<Props, State> {
  handlers: any = undefined;
  filters: any = undefined;
  keymap: any = undefined;

  state: State = {
    filter: "",
  };

  constructor(props: Props) {
    super(props);

    this.handlers = getHandlers(props);
    this.filters = getFilters(this.handlers);
    this.keymap = getKeymap(this.filters);
  }

  getFilteredData = (search: string) => {
    return (
      this.filters.filter(
        (filter: Filter) =>
          filter.text.toLowerCase().indexOf(search.toLowerCase()) > -1
      ) || []
    );
  };

  handleChange = (value: string) => {
    this.setState({ filter: value });
  };

  componentDidUpdate(previousProps: Props) {
    if (previousProps.isVisible !== this.props.isVisible) {
      this.handleChange("");
    }
  }
  render() {
    const { isVisible, onToggleVisibility } = this.props;
    const data = this.getFilteredData(this.state.filter);
    const handlers = getHandlers(this.props);

    return isVisible ? (
      <GlobalHotKeys keyMap={this.keymap} handlers={handlers}>
        <Palette
          placeholder="Filter commands"
          onChangeFilter={this.handleChange}
          shortCut={[commandOrControl, "P"]}
          isVisible={isVisible}
          onClose={onToggleVisibility}
        >
          {data.map((item: Filter) => (
            <CommandButtonRow
              key={item.text}
              onClick={item.onClick}
              shortCut={item.displayShortcut}
            >
              {item.icon}
              {item.text}
            </CommandButtonRow>
          ))}
        </Palette>
      </GlobalHotKeys>
    ) : null;
  }
}

const Container = (props: ComponentProps) => {
  return (
    <CommandContainer contentRef={props.contentRef} id="command-palette">
      <CommandContext.Consumer>
        {(commandActions: any) => (
          <CommandPalette
            {...props}
            addCellBelow={commandActions.addCellBelow}
            addCellAbove={commandActions.addCellAbove}
            restartAndRun={commandActions.restartAndRun}
            hideOutput={commandActions.hideOutput}
            hideInput={commandActions.hideInput}
            convertToMarkdown={commandActions.convertToMarkdown}
          />
        )}
      </CommandContext.Consumer>
    </CommandContainer>
  );
};

export default Container;
