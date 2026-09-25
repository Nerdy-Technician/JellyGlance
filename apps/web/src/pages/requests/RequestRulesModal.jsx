import { useEffect, useState } from "react";
import { Modal, Spinner } from "react-bootstrap";
import axios from "../../lib/axios_instance";

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}` };
}

function NumberField({ label, value, onChange, min = 0, max = 999, suffix }) {
  return (
    <label className="request-rules-field">
      <span>{label}</span>
      <div>
        <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        {suffix ? <em>{suffix}</em> : null}
      </div>
    </label>
  );
}

function Toggle({ label, help, checked, onChange }) {
  return (
    <label className="request-rules-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <div>
        <strong>{label}</strong>
        {help ? <small>{help}</small> : null}
      </div>
    </label>
  );
}

export default function RequestRulesModal({ show, onHide }) {
  const [users, setUsers] = useState([]);
  const [rules, setRules] = useState(null);
  const [usage, setUsage] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!show) return;
    setMessage("");
    axios
      .get("/api/requests/rules", { headers: authHeader() })
      .then((response) => {
        setRules(response.data.rules);
        setUsage(response.data.usage || []);
      })
      .catch((error) => setMessage(error.response?.data?.error || "Unable to load request rules."));
    axios
      .get("/insights-data/wrapped/years", { headers: authHeader() })
      .then((response) => setUsers((response.data.users || []).map((user) => ({ value: user.id, label: user.name }))))
      .catch(() => {});
  }, [show]);

  const set = (patch) => setRules((current) => ({ ...current, ...patch }));
  const setUser = (key, patch) =>
    setRules((current) => ({
      ...current,
      users: { ...current.users, [key]: { mode: "default", autoApprove: "default", movieLimit: current.movieLimit, tvLimit: current.tvLimit, ...(current.users[key] || {}), ...patch } },
    }));

  async function save() {
    try {
      setSaving(true);
      const response = await axios.put("/api/requests/rules", rules, { headers: authHeader() });
      setRules(response.data.rules);
      setUsage(response.data.usage || []);
      setMessage("Saved.");
    } catch (error) {
      setMessage(error.response?.data?.error || "Unable to save request rules.");
    } finally {
      setSaving(false);
    }
  }

  const usageByKey = new Map(usage.map((row) => [row.user_key, row]));
  const knownUsers = [...users];
  usage.forEach((row) => {
    if (!knownUsers.some((user) => user.value === row.user_key)) knownUsers.push({ value: row.user_key, label: row.user_name });
  });

  return (
    <Modal show={show} onHide={onHide} centered size="lg" contentClassName="requests-modal request-rules-modal">
      <Modal.Header closeButton>
        <Modal.Title>Request rules</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {!rules ? (
          message ? <p>{message}</p> : <Spinner animation="border" size="sm" />
        ) : (
          <div className="request-rules">
            <Toggle
              label="Limit how much people can request"
              help="Counts requests made through JellyGlance. When someone hits their limit, the request button tells them when their next one frees up."
              checked={rules.enabled}
              onChange={(enabled) => set({ enabled })}
            />
            <div className={`request-rules-grid${rules.enabled ? "" : " is-disabled"}`}>
              <NumberField label="Movies" value={rules.movieLimit} onChange={(movieLimit) => set({ movieLimit })} suffix="requests" />
              <NumberField label="every" value={rules.movieDays} min={1} max={365} onChange={(movieDays) => set({ movieDays })} suffix="days" />
              <NumberField label="TV shows" value={rules.tvLimit} onChange={(tvLimit) => set({ tvLimit })} suffix="requests" />
              <NumberField label="every" value={rules.tvDays} min={1} max={365} onChange={(tvDays) => set({ tvDays })} suffix="days" />
            </div>
            <Toggle label="Admins have no limit" checked={rules.exemptAdmins} onChange={(exemptAdmins) => set({ exemptAdmins })} />
            <Toggle
              label="File requests in Seerr under each person's own account"
              help="Without this, Seerr sees every JellyGlance request as coming from the admin and approves it straight away. With it on, Seerr uses that person's own approval settings and they show as the requester."
              checked={rules.requestAsSeerrUser}
              onChange={(requestAsSeerrUser) => set({ requestAsSeerrUser })}
            />
            <Toggle
              label="Auto-approve everyone"
              help="Approve new requests straight away unless a person is set to Never below. Admins are always auto-approved."
              checked={rules.autoApproveAll}
              onChange={(autoApproveAll) => set({ autoApproveAll })}
            />

            <h4>Per person</h4>
            <table className="request-rules-users">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Used</th>
                  <th>Limit</th>
                  <th>Auto-approve</th>
                </tr>
              </thead>
              <tbody>
                {knownUsers.map((user) => {
                  const rule = rules.users[user.value] || { mode: "default", autoApprove: "default" };
                  const used = usageByKey.get(user.value);
                  return (
                    <tr key={user.value}>
                      <td>{user.label}</td>
                      <td>
                        {used ? `${used.movies} movies, ${used.tv} TV` : "None"}
                      </td>
                      <td>
                        <select value={rule.mode} onChange={(event) => setUser(user.value, { mode: event.target.value })}>
                          <option value="default">Default</option>
                          <option value="custom">Custom</option>
                          <option value="unlimited">No limit</option>
                        </select>
                        {rule.mode === "custom" ? (
                          <span className="request-rules-custom">
                            <input type="number" min={0} value={rule.movieLimit ?? rules.movieLimit} onChange={(event) => setUser(user.value, { movieLimit: Number(event.target.value) })} title="Movies" /> movies
                            <input type="number" min={0} value={rule.tvLimit ?? rules.tvLimit} onChange={(event) => setUser(user.value, { tvLimit: Number(event.target.value) })} title="TV" /> TV
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <select value={rule.autoApprove} onChange={(event) => setUser(user.value, { autoApprove: event.target.value })}>
                          <option value="default">Default</option>
                          <option value="always">Always</option>
                          <option value="never">Never</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {message ? <span className="request-rules-message">{message}</span> : null}
        <button type="button" className="btn btn-outline-secondary" onClick={onHide}>
          Close
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!rules || saving}>
          {saving ? <Spinner animation="border" size="sm" /> : null} Save rules
        </button>
      </Modal.Footer>
    </Modal>
  );
}
