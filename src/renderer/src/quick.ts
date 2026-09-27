import '@fontsource-variable/inter'
import './styles/base.css'
import { mount } from 'svelte'
import AskApp from './ask/AskApp.svelte'

mount(AskApp, { target: document.getElementById('quick')! })
