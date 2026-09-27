import '@fontsource-variable/inter'
import './styles/base.css'
import { mount } from 'svelte'
import App from './App.svelte'

mount(App, { target: document.getElementById('app')! })
