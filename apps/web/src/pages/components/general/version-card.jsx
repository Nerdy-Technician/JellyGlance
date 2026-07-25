import { useState, useEffect } from "react";
import axios from "../../../lib/axios_instance";
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import "../../css/settings/version.css";
import { Button, Card, Spinner } from "react-bootstrap";

function formatBackupDate(value) {
  if (!value) return "No backup found";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function VersionCard() {

  const token = localStorage.getItem('token');
  const [data, setData] = useState({ current_version: "Loading", update_available: false });
  const [backupSummary, setBackupSummary] = useState({ count: 0, latestBackup: null });
  const [backupBusy, setBackupBusy] = useState(false);

  async function createBackup() {
    try {
      setBackupBusy(true);
      await axios.get("/backup/beginBackup", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const response = await axios.get("/backup/summary", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      setBackupSummary(response.data || { count: 0, latestBackup: null });
    } finally {
      setBackupBusy(false);
    }
  }

  useEffect(() => {

    const fetchVersion = () => {
      axios
        .get("/auth/isConfigured")
        .then((response) => {
          setData((current) => ({
            ...current,
            current_version: response.data.version || current.current_version,
          }));
        })
        .catch(() => {});

      if (token) {
        const url = `/api/CheckForUpdates`;

        axios
        .get(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })
          .then((data) => {
            setData(data.data);
          })
          .catch(() => {});

        axios
          .get("/backup/summary", {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })
          .then((response) => setBackupSummary(response.data || { count: 0, latestBackup: null }))
          .catch(() => {});
      }
    };
    fetchVersion();

    const intervalId = setInterval(fetchVersion, 60000 * 5);
    return () => clearInterval(intervalId);
  }, [token]);


    return (
    <Card  className="version rounded-0 border-0" >
       <Card.Body>
            <Row>
                 <Col>JellyGlance {data.current_version}</Col>
             </Row>
             

            {data.update_available?
              <>
                <Row>
                     <Col ><a href={data.releases_url || "https://github.com/Nerdy-Technician/JellyGlance/releases"} target="_blank"  rel="noreferrer"  style={{color:'#00A4DC'}}>New version available: {data.latest_version}</a></Col>
                 </Row>
                <Row className="version-backup-row">
                  <Col>
                    <span>Latest backup: {formatBackupDate(backupSummary.latestBackup?.datecreated)}</span>
                    <Button size="sm" variant="outline-info" type="button" onClick={createBackup} disabled={backupBusy || !token}>
                      {backupBusy ? <Spinner animation="border" size="sm" /> : "Run backup now"}
                    </Button>
                  </Col>
                </Row>
              </>
               :
               <></>
            }

       </Card.Body>
   </Card>
    );


}
