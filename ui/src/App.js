import './App.scss';
import Chat from './components/Chat/Chat'
import Navbar from './components/Navbar/Navbar'

function App() {
  return (
    <div className='App'>
      <Navbar />
      <Chat />
      {/* <Home /> */}
    </div>
  );
}

export default App;
