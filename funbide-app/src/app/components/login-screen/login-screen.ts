import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login-screen',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login-screen.html',
  styleUrls: ['./login-screen.css']
})
export class LoginScreenComponent {
  @Input() username = '';
  @Input() password = '';
  @Input() errorMessage = '';
  @Input() isLoading = false;
  @Output() usernameChange = new EventEmitter<string>();
  @Output() passwordChange = new EventEmitter<string>();
  @Output() rememberMeChange = new EventEmitter<boolean>();
  @Output() submitLogin = new EventEmitter<void>();

  showPassword = false;
  rememberMe = false;
  localErrorMessage = '';

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (!this.username.trim()) {
      this.localErrorMessage = 'Ingrese su usuario';
      return;
    }
    if (!this.password.trim()) {
      this.localErrorMessage = 'Ingrese su contraseña';
      return;
    }
    this.localErrorMessage = '';
    this.submitLogin.emit();
  }

  onUsernameChange(value: string) {
    this.username = value;
    this.usernameChange.emit(value);
  }

  onPasswordChange(value: string) {
    this.password = value;
    this.passwordChange.emit(value);
  }

  onRememberMeChange(value: boolean) {
    this.rememberMe = value;
    this.rememberMeChange.emit(value);
  }
}

