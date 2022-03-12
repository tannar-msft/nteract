import { mount } from "enzyme";
import * as Immutable from "immutable";
import * as React from "react";

import { PromptRequest } from "../../src/outputs/input-prompts";

describe("PromptRequest", () => {
  it("renders no forms when given no prompts", () => {
    const component = mount(<PromptRequest prompts={Immutable.List([])} />);
    expect(component.find("form")).toHaveLength(0);
  });
  it("renders one form when given multiple prompts", () => {
    const component = mount(
      <PromptRequest
        prompts={Immutable.List([
          {
            prompt: "A prompt",
            password: false
          },
          {
            prompt: "Another prompt",
            password: false
          }
        ])}
      />
    );
    expect(component.find("form")).toHaveLength(1);
  });
});
