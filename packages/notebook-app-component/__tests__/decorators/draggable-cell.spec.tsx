import { emptyMarkdownCell } from "@nteract/commutable";
import { actions } from "@nteract/core";
import { mount, shallow } from "enzyme";
import React from "react";
import { Provider } from "react-redux";

import { fixtureStore } from "@nteract/fixtures";

import DraggableCell, {
  cellTarget,
  DraggableCellView,
  isDragUpper,
  makeMapDispatchToProps
} from "../../src/decorators/draggable";

// Spoof DND manager for tests.
const dragDropManager = {
  getMonitor: () => ({
    subscribeToStateChange: () => {},
    isDraggingSource: () => {}
  }),
  getBackend: () => {},
  getRegistry: () => ({
    addSource: () => {},
    removeSource: () => {}
  })
};

describe("DraggableCell", () => {
  test("can be rendered", () => {
    const store = fixtureStore();
    const cell = shallow(<Provider store={store}>
      <DraggableCell cell={emptyMarkdownCell} />
      </Provider>, {
      context: { dragDropManager }
    });
    expect(cell).not.toBeNull();
  });
});

describe("DraggableCellView", () => {
  test("can be rendered", () => {
    const connectDragPreview = jest.fn(el => el);
    const connectDragSource = jest.fn(el => el);
    const connectDropTarget = jest.fn(el => el);
    const focusCell = jest.fn();
    const moveCell = jest.fn();
    const cell = mount(
      <DraggableCellView
        connectDragPreview={connectDragPreview}
        connectDragSource={connectDragSource}
        isDragging={false}
        isOver={false}
        connectDropTarget={connectDropTarget}
        focusCell={focusCell}
        moveCell={moveCell}
        id="cellId"
        contentRef="contentRef"
      >
        <p>Children</p>
      </DraggableCellView>
    );
    expect(cell).not.toBeNull();
  });
});

describe("isDragUpper", () => {
  it("returns true if the object is dragged upward", () => {
    const el = {
      getBoundingClientRect: jest.fn(() => ({
        bottom: 20,
        top: 2
      }))
    };
    const monitor = {
      getClientOffset: jest.fn(() => ({
        top: 1,
        y: 2
      }))
    };
    const result = isDragUpper({}, monitor, el);
    expect(result).toBe(true);
  });
  it("returns false if the object is dragged upward", () => {
    const el = {
      getBoundingClientRect: jest.fn(() => ({
        bottom: 3,
        top: 1
      }))
    };
    const monitor = {
      getClientOffset: jest.fn(() => ({
        top: 1,
        y: 10
      }))
    };
    const result = isDragUpper({}, monitor, el);
    expect(result).toBe(false);
  });
});

describe("makeMapDispatchToProps", () => {
  it("registers actions to dispatch", () => {
    const dispatch = jest.fn();
    const result = makeMapDispatchToProps(dispatch)(dispatch);
    const payload = {
      id: "test",
      destinationId: "test1",
      above: false,
      contentRef: "contentRef"
    };
    result.moveCell({
      id: "test",
      destinationId: "test1",
      above: false,
      contentRef: "contentRef"
    });
    expect(dispatch).toBeCalledWith(actions.moveCell(payload));
    const focusPayload = { id: "cellId", contentRef: "contentRef" };
    result.focusCell(focusPayload);
    expect(dispatch).toBeCalledWith(actions.focusCell(focusPayload));
  });
});

describe("cellTarget", () => {
  it("move cell when dropped", () => {
    const props = {
      contentRef: "contentRef",
      id: "cellId",
      moveCell: jest.fn()
    };
    const monitor = {
      getItem: jest.fn(() => ({ id: "cellId " })),
      getClientOffset: jest.fn(() => ({
        top: 1,
        y: 2
      }))
    };
    const component = {
      el: {
        getBoundingClientRect: jest.fn(() => ({
          bottom: 20,
          top: 2
        }))
      }
    };
    cellTarget.drop(props, monitor, component);
    expect(props.moveCell).toBeCalled();
  });
  it("hover sets component state", () => {
    const component = {
      setState: jest.fn(),
      el: {
        getBoundingClientRect: jest.fn(() => ({
          bottom: 20,
          top: 2
        }))
      }
    };
    const monitor = {
      getItem: jest.fn(() => ({ id: "cellId " })),
      getClientOffset: jest.fn(() => ({
        top: 1,
        y: 2
      }))
    };
    const props = {
      contentRef: "contentRef",
      id: "cellId",
      moveCell: jest.fn()
    };
    cellTarget.hover(props, monitor, component);
  });
});
