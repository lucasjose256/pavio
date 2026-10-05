import { render } from 'preact';
import '../theme.css';
import './options.css';
import { App } from './App';

render(<App />, document.getElementById('app')!);
