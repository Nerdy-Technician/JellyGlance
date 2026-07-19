import { useState, useEffect } from "react";
import axios from "../../../lib/axios_instance";
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import "../../css/settings/version.css";
import { Card } from "react-bootstrap";

export default function VersionCard() {

  const token = localStorage.getItem('token');
  const [data, setData] = useState({ current_version: "Loading", update_available: false });
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
              <Row>
                   <Col ><a href={data.releases_url || "https://github.com/Nerdy-Technician/JellyGlance/releases"} target="_blank"  rel="noreferrer"  style={{color:'#00A4DC'}}>New version available: {data.latest_version}</a></Col>
               </Row>
               :
               <></>
            }

       </Card.Body>
   </Card>
    );


}
