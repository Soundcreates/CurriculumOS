import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import { ScrollSmoother } from "gsap/all";
import gsap from "gsap";


function AppLayout() {

  
 return(
    <div >
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
        </Routes>
      </Router>
    </div>
  );
}
function App() {
  return <AppLayout />;
}

export default App;
