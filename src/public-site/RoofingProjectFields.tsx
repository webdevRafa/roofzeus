import { roofMaterials } from "./modernize";
import {
  roofingPlans,
  availableRoofMaterial,
  type RoofingProject,
} from "./roofing-project";

export default function RoofingProjectFields({
  project,
  materials,
  onChange,
}: {
  project: RoofingProject;
  materials: string[];
  onChange: (patch: Partial<RoofingProject>) => void;
}) {
  const knownPlan = roofingPlans.includes(project.plan);
  const available = Object.entries(roofMaterials).filter(([key]) =>
    materials.includes(key),
  );
  const hasMaterial = availableRoofMaterial(project.material, materials);
  return (
    <>
      <p>
        Choose the kind of estimate you want. A roofer can confirm the work your
        home needs.
      </p>
      <fieldset className="rz-choice-grid rz-roofing-options">
        <legend className="rz-sr-only">Roofing need</legend>
        {[
          ["repair", "Roof repair"],
          ["replacement", "Roof replacement"],
          ["new", "New construction"],
        ].map(([value, label]) => (
          <label
            key={value}
            className={project.plan === value ? "selected" : ""}
          >
            <input
              name="plan"
              type="radio"
              value={value}
              required
              checked={project.plan === value}
              onChange={() =>
                onChange({ plan: value, material: "", timeframe: "" })
              }
            />
            {label}
          </label>
        ))}
      </fieldset>

      {knownPlan && available.length > 0 && (
        <>
          <label className="rz-field">
            {project.plan === "repair"
              ? "What material is on your roof now?"
              : "What material would you like installed?"}
            <select
              name="material"
              required
              value={project.material}
              aria-describedby="roof-material-help"
              onChange={(event) =>
                onChange({ material: event.target.value, timeframe: "" })
              }
            >
              <option value="">Choose a material</option>
              {available.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p id="roof-material-help" className="rz-field-help">
            {project.plan === "repair"
              ? "Choose the existing roof covering so we can look for the right repair service."
              : "Choose the material you want an estimate for. Your roofer can discuss suitability and alternatives."}
          </p>
          <details className="rz-project-help">
            <summary>Not sure about the material?</summary>
            <p>
              {project.plan === "repair"
                ? "Check a roof invoice or warranty, or ask a roofing professional to identify the covering. Choose only a material you can confirm."
                : "You don’t need a final specification, but you do need a material preference for this estimate. If you haven’t chosen one, ask a roofer to help you compare options first."}
            </p>
            <p>
              This form covers the materials listed above. Inspection-only
              requests aren’t available through this estimate form.
            </p>
          </details>
        </>
      )}

      {knownPlan && available.length === 0 && (
        <p className="rz-note" role="status">
          Roofing estimates aren’t available through this form right now. Please
          check back later. No request has been submitted.
        </p>
      )}

      {knownPlan && hasMaterial && (
        <label className="rz-field">
          When do you need help?
          <select
            name="timeframe"
            required
            value={project.timeframe}
            onChange={(event) => onChange({ timeframe: event.target.value })}
          >
            <option value="">Choose timing</option>
            <option value="Immediately">As soon as possible</option>
            <option value="1-6 months">Within 1–6 months</option>
            <option value="Don't know">Just planning / not sure</option>
          </select>
        </label>
      )}
      <p className="rz-field-help">
        For residential repair, replacement, or new-roof estimates. This is not
        an emergency dispatch service.
      </p>
    </>
  );
}
