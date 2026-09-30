import {
  type CheckBusinessHoursStepSchema,
  checkBusinessHoursStepDefaultFn,
  checkBusinessHoursStepSchema,
} from "@chatbotx.io/flow-config"
import type { StepDefinition } from "../definition"
import CheckBusinessHoursStepEditor from "./editor"
import CheckBusinessHoursStepViewer from "./viewer"

export const checkBusinessHoursStep: StepDefinition<CheckBusinessHoursStepSchema> =
  {
    editor: CheckBusinessHoursStepEditor,
    viewer: CheckBusinessHoursStepViewer,
    validator: checkBusinessHoursStepSchema,
    defaultFn: checkBusinessHoursStepDefaultFn,
  }
