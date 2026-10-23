import { describe, expect, it } from "vitest"
import {
  formatElapsed,
  getReasonLabel,
  getStepLabel,
  summarizeStepDetails,
  translateStepMessage,
} from "../sysbrazo-labels"

describe("getStepLabel", () => {
  it("usa la etiqueta de Sysbrazo para pasos conocidos", () => {
    expect(getStepLabel("initializing")).toBe("Inicializando diagnóstico")
    expect(getStepLabel("check_credit")).toBe("Validando estado de cuenta")
    expect(getStepLabel("get_cpe_gpon_power_Info")).toBe(
      "Revisando niveles de señal de fibra óptica",
    )
    expect(getStepLabel("finalizing")).toBe("Finalizando diagnóstico")
  })

  it("formatea el nombre para pasos sin etiqueta", () => {
    expect(getStepLabel("some_future_step")).toBe("Some Future Step")
  })
})

describe("getReasonLabel", () => {
  it("traduce códigos conocidos al español", () => {
    expect(getReasonLabel("CLIENT_HAS_OPEN_INCIDENT")).toBe(
      "Cliente tiene un incidente abierto",
    )
    expect(getReasonLabel("PING_BATCH_RETRY_FAILED")).toBe(
      "Ping falló después de reintentos",
    )
  })

  it("usa el código formateado como fallback", () => {
    expect(getReasonLabel("SOME_NEW_CODE")).toBe("SOME NEW CODE")
    expect(getReasonLabel("some_new_code")).toBe("Some New Code")
  })
})

describe("formatElapsed", () => {
  it("muestra segundos bajo el minuto", () => {
    expect(formatElapsed(21)).toBe("21s")
    expect(formatElapsed(0)).toBe("0s")
  })

  it("muestra minutos y segundos pasados 60s", () => {
    expect(formatElapsed(330)).toBe("5m 30s")
  })
})

describe("summarizeStepDetails", () => {
  it("devuelve null cuando no hay detalles", () => {
    expect(summarizeStepDetails(null)).toBeNull()
    expect(summarizeStepDetails(undefined)).toBeNull()
    expect(summarizeStepDetails({})).toBeNull()
  })

  it("tolera details como array (shape variable de Sysbrazo)", () => {
    expect(summarizeStepDetails([])).toBeNull()
    expect(summarizeStepDetails([{ foo: "bar" }])).toBeNull()
    expect(summarizeStepDetails("texto")).toBeNull()
  })

  it("resume la información de crédito", () => {
    expect(
      summarizeStepDetails({
        creditInfo: { hasExpired: false, expirationDate: "2026/11/01" },
      }),
    ).toBe("Crédito vigente: 2026/11/01")
    expect(summarizeStepDetails({ creditInfo: { hasExpired: true } })).toBe(
      "Crédito expirado",
    )
  })

  it("resume el resultado del ping", () => {
    expect(
      summarizeStepDetails({
        ipping: { success_count: 3, diagnostics_state: "Complete" },
      }),
    ).toBe("Ping exitoso (3 éxitos)")
    expect(
      summarizeStepDetails({
        ipping: { SuccessCount: 0, state: "Complete" },
      }),
    ).toBe("Ping fallido (0 éxitos)")
    expect(summarizeStepDetails({ ipping: { state: "InProgress" } })).toBe(
      "Ping: InProgress",
    )
  })

  it("traduce el reason interno del paso", () => {
    expect(summarizeStepDetails({ reason: "CPE_LOSS_OF_SIGNAL" })).toBe(
      "Pérdida de señal (LOS)",
    )
  })
})

describe("translateStepMessage", () => {
  it("traduce mensajes conocidos", () => {
    expect(translateStepMessage("Initialization completed")).toBe(
      "Inicialización de reparación completada",
    )
  })

  it("traduce mensajes dinámicos de speedtest", () => {
    expect(
      translateStepMessage("Speedtest upload is taking longer than expected"),
    ).toBe("La prueba de subida está tomando más tiempo del esperado")
  })

  it("deja pasar mensajes sin traducción", () => {
    expect(translateStepMessage("Unknown raw message")).toBe(
      "Unknown raw message",
    )
  })
})
